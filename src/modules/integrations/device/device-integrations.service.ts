import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { Op, UniqueConstraintError } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { AthleteProfileService } from '../../training/athletes/athlete-profile.service';
import { ageFromBirthDate } from '../../training/athletes/profile-completeness';
import { Athlete } from '../../training/entities/athlete.entity';
import { Workout } from '../../training/entities/workout.entity';
import { ATHLETE_RANGES } from '../../training/training.constants';
import { TrainingService } from '../../training/training.service';
import { UserConsentsService } from '../../users/consents/user-consents.service';
import {
  DEVICE_BATCH_RETENTION_DAYS,
  DEVICE_PROVIDER_PLATFORMS,
  DEVICE_PROVIDERS,
  DEVICE_SYNC_BATCH_MAX,
  DEVICE_SYNC_HISTORY_DEFAULT_DAYS,
  type DeviceProviderName,
  INTEGRATION_STATUSES,
  INTEGRATIONS_QUEUE_NAME,
  JOB_DEVICE_PROCESS_BATCH,
  PROFILE_METRIC_MAX_AGE_DAYS,
  RESTING_HR_MEDIAN_DAYS,
  RESTING_HR_MIN_DAYS,
  SYNC_STATUSES,
  WEBHOOK_EVENT_STATUSES,
} from '../constants/integrations.constants';
import { IntegrationItemResponseDto } from '../dto/integration-response.dto';
import { DeviceBatchCounters, DeviceSyncBatch, DeviceSyncBatchPayload } from '../entities/device-sync-batch.entity';
import { Integration } from '../entities/integration.entity';
import { IntegrationSyncState } from '../entities/integration-sync-state.entity';
import { WorkoutSource } from '../entities/workout-source.entity';
import { IntegrationConnectedEvent } from '../events/integration-connected.event';
import { IntegrationDisconnectedEvent } from '../events/integration-disconnected.event';
import { ActivityIngestionService, IngestOutcome } from '../ingestion/activity-ingestion.service';
import { toIntegrationItem } from '../integration-item.mapper';
import { checkDeviceActivity, restingHeartRateMedian, toRunningActivity } from './device-activity.rules';
import { DeviceSyncBatchProcessedEvent, DeviceSyncCompletedEvent } from './device-sync.events';
import { DeviceConnectionDto, UpdateDeviceConnectionDto } from './dto/device-connection.dto';
import {
  DeviceProfileMetricsDto,
  DeviceProfileMetricsResultDto,
  ProfileMetricField,
  SkippedProfileMetricDto,
} from './dto/device-profile-metrics.dto';
import { DeviceSyncBatchAcceptedDto, DeviceSyncBatchDto } from './dto/device-sync-batch.dto';
import { DeviceSyncStatusResponseDto, WorkoutSourcesResponseDto } from './dto/device-sync-status.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_STATUSES = [WEBHOOK_EVENT_STATUSES.PENDING, WEBHOOK_EVENT_STATUSES.PROCESSING];

export interface ProcessBatchJobData {
  batchId: string;
}

/** Device-side metadata kept in `integrations.metadata`. */
interface DeviceMetadata {
  platform?: 'ios' | 'android';
  osVersion?: string;
  appVersion?: string;
  lastDeviceId?: string;
  historyDepthDays?: number;
  profileSync?: boolean;
  lastSync?: { syncId: string; syncType: string; counters: DeviceBatchCounters };
}

export function emptyCounters(): DeviceBatchCounters {
  return {
    created: 0,
    updated: 0,
    merged: 0,
    matchedPlanned: 0,
    matchedManual: 0,
    skipped: 0,
    rejected: 0,
    deleted: 0,
    failed: 0,
  };
}

const OUTCOME_COUNTER: Record<IngestOutcome, keyof DeviceBatchCounters> = {
  created: 'created',
  updated: 'updated',
  merged: 'merged',
  matched_planned: 'matchedPlanned',
  matched_manual: 'matchedManual',
  skipped_own_record: 'skipped',
  skipped_origin_connected: 'skipped',
};

/**
 * Apple Health and Health Connect have no server API: the app reads the
 * records on the device and pushes them here. Batches are stored first and
 * processed in the integrations queue, so a 202 means the data is safe and
 * the app may move its sync cursor.
 */
@Injectable()
export class DeviceIntegrationsService {
  private readonly logger = new Logger(DeviceIntegrationsService.name);

  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    @InjectModel(DeviceSyncBatch)
    private readonly batchModel: typeof DeviceSyncBatch,
    @InjectModel(IntegrationSyncState)
    private readonly syncStateModel: typeof IntegrationSyncState,
    @InjectModel(WorkoutSource)
    private readonly sourceModel: typeof WorkoutSource,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectQueue(INTEGRATIONS_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly trainingService: TrainingService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly consentsService: UserConsentsService,
    private readonly ingestion: ActivityIngestionService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ------------------------------------------------------------- connection

  async connect(userId: string, providerParam: string, dto: DeviceConnectionDto): Promise<IntegrationItemResponseDto> {
    const provider = this.resolveProvider(providerParam);
    if (DEVICE_PROVIDER_PLATFORMS[provider] !== dto.platform) {
      throw new DomainException(
        'PROVIDER_PLATFORM_MISMATCH',
        `${provider} is available only on ${DEVICE_PROVIDER_PLATFORMS[provider]}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.consentsService.assertCurrent(userId, 'health_data');
    const athlete = await this.trainingService.getOrCreateAthlete(userId);

    let integration = await this.integrationModel.findOne({
      where: { athleteId: athlete.id, provider },
      paranoid: false,
    });
    if (integration?.deletedAt) {
      await integration.restore();
    }
    const wasConnected = !!integration && integration.status !== INTEGRATION_STATUSES.DISCONNECTED;
    const metadata: DeviceMetadata = {
      ...((integration?.metadata as DeviceMetadata | undefined) ?? {}),
      platform: dto.platform,
      osVersion: dto.osVersion,
      appVersion: dto.appVersion,
      lastDeviceId: dto.deviceId,
      historyDepthDays: dto.historyDepthDays ?? DEVICE_SYNC_HISTORY_DEFAULT_DAYS,
      profileSync: dto.profileSync ?? (integration?.metadata as DeviceMetadata | undefined)?.profileSync ?? true,
    };

    if (integration) {
      integration.metadata = metadata as Record<string, unknown>;
      integration.changed('metadata', true);
      integration.scopes = dto.grantedScopes ?? integration.scopes ?? [];
      if (!wasConnected) {
        integration.status = INTEGRATION_STATUSES.CONNECTED;
        integration.connectedAt = new Date();
        integration.disconnectedAt = null;
        integration.lastSyncError = null;
      }
      await integration.save();
    } else {
      integration = await this.integrationModel.create({
        athleteId: athlete.id,
        provider,
        status: INTEGRATION_STATUSES.CONNECTED,
        externalUserId: null,
        scopes: dto.grantedScopes ?? [],
        metadata,
        connectedAt: new Date(),
      });
    }

    if (!wasConnected) {
      this.eventEmitter.emit(
        'integrations.connected',
        new IntegrationConnectedEvent(integration.id, athlete.id, provider),
      );
    }
    return this.toItem(integration);
  }

  async updateConnection(
    userId: string,
    providerParam: string,
    dto: UpdateDeviceConnectionDto,
  ): Promise<IntegrationItemResponseDto> {
    const provider = this.resolveProvider(providerParam);
    const integration = await this.loadConnected(userId, provider);
    const metadata: DeviceMetadata = { ...(integration.metadata as DeviceMetadata) };
    if (dto.profileSync !== undefined) {
      metadata.profileSync = dto.profileSync;
    }
    if (dto.osVersion !== undefined) {
      metadata.osVersion = dto.osVersion;
    }
    if (dto.appVersion !== undefined) {
      metadata.appVersion = dto.appVersion;
    }
    integration.metadata = metadata as Record<string, unknown>;
    integration.changed('metadata', true);
    if (dto.grantedScopes !== undefined) {
      integration.scopes = dto.grantedScopes;
    }
    await integration.save();
    return this.toItem(integration);
  }

  /** Already accepted batches are still processed; imported workouts stay. */
  async disconnect(userId: string, providerParam: string): Promise<{ success: boolean }> {
    const provider = this.resolveProvider(providerParam, { allowWhenDisabled: true });
    const athlete = await this.trainingService.getOrCreateAthlete(userId);
    const integration = await this.integrationModel.findOne({ where: { athleteId: athlete.id, provider } });
    if (!integration) {
      throw new EntityNotFoundException('Integration', provider);
    }
    await this.markDisconnected(integration);
    return { success: true };
  }

  /** Health data consent revoked: both device providers stop accepting data. */
  async disconnectAllForUser(userId: string): Promise<number> {
    const athlete = await this.athleteModel.findOne({ where: { userId }, attributes: ['id'] });
    if (!athlete) {
      return 0;
    }
    const integrations = await this.integrationModel.findAll({
      where: {
        athleteId: athlete.id,
        provider: [...DEVICE_PROVIDERS],
        status: { [Op.ne]: INTEGRATION_STATUSES.DISCONNECTED },
      },
    });
    for (const integration of integrations) {
      await this.markDisconnected(integration);
    }
    return integrations.length;
  }

  // ---------------------------------------------------------------- batches

  async acceptBatch(
    userId: string,
    providerParam: string,
    dto: DeviceSyncBatchDto,
  ): Promise<DeviceSyncBatchAcceptedDto> {
    const provider = this.resolveProvider(providerParam);
    const deleted = dto.deletedSourceActivityIds ?? [];
    if (dto.activities.length + deleted.length > DEVICE_SYNC_BATCH_MAX) {
      throw new DomainException(
        'SYNC_BATCH_TOO_LARGE',
        `A batch holds at most ${DEVICE_SYNC_BATCH_MAX} records`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    const integration = await this.loadConnected(userId, provider);

    const existing = await this.batchModel.findOne({
      where: { integrationId: integration.id, syncId: dto.syncId, batchIndex: dto.batchIndex },
    });
    if (existing) {
      return this.toAccepted(existing);
    }

    const payload = this.validateBatch(dto, new Date());
    let batch: DeviceSyncBatch;
    try {
      batch = await this.batchModel.create({
        integrationId: integration.id,
        syncId: dto.syncId,
        batchIndex: dto.batchIndex,
        syncType: dto.syncType,
        isLast: dto.isLast,
        payload,
        status: WEBHOOK_EVENT_STATUSES.PENDING,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const raced = await this.batchModel.findOne({
          where: { integrationId: integration.id, syncId: dto.syncId, batchIndex: dto.batchIndex },
        });
        if (raced) {
          return this.toAccepted(raced);
        }
      }
      throw error;
    }

    await this.ensureSyncState(integration, dto);
    if (integration.status !== INTEGRATION_STATUSES.SYNCING) {
      integration.status = INTEGRATION_STATUSES.SYNCING;
      await integration.save();
    }
    await this.queue.add(JOB_DEVICE_PROCESS_BATCH, { batchId: batch.id } satisfies ProcessBatchJobData, {
      jobId: `device-batch:${batch.id}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: 1000,
    });
    return this.toAccepted(batch);
  }

  /**
   * Imports one accepted batch. The integrations queue runs one job at a time,
   * which serializes ingestion per athlete as `ActivityIngestionService` requires.
   */
  async processBatch(batchId: string): Promise<void> {
    const batch = await this.batchModel.findByPk(batchId);
    if (!batch || batch.status === WEBHOOK_EVENT_STATUSES.PROCESSED) {
      return;
    }
    const integration = await this.integrationModel.findByPk(batch.integrationId);
    if (!integration) {
      batch.status = WEBHOOK_EVENT_STATUSES.IGNORED;
      await batch.save();
      return;
    }
    const provider = integration.provider as DeviceProviderName;

    batch.status = WEBHOOK_EVENT_STATUSES.PROCESSING;
    batch.attempts += 1;
    await batch.save();

    const counters = emptyCounters();
    counters.rejected = batch.payload.rejected.length;
    const failedSourceActivityIds: string[] = [];

    try {
      for (const stored of batch.payload.activities) {
        try {
          const result = await this.ingestion.ingest(toRunningActivity(integration.athleteId, provider, stored));
          counters[OUTCOME_COUNTER[result.outcome]] += 1;
        } catch (error) {
          counters.failed += 1;
          failedSourceActivityIds.push(stored.sourceActivityId);
          this.logger.error(
            `Device activity ${provider}:${stored.sourceActivityId} failed: ${(error as Error).message}`,
            (error as Error).stack,
          );
        }
      }
      for (const sourceActivityId of batch.payload.deletedSourceActivityIds) {
        const outcome = await this.ingestion.removeSource(integration.athleteId, provider, sourceActivityId);
        if (outcome !== 'ignored') {
          counters.deleted += 1;
        }
      }
    } catch (error) {
      const message = (error as Error).message;
      batch.status = WEBHOOK_EVENT_STATUSES.FAILED;
      batch.error = message;
      await batch.save();
      integration.status = INTEGRATION_STATUSES.ERROR;
      integration.lastSyncError = message;
      await integration.save();
      throw error;
    }

    batch.status = WEBHOOK_EVENT_STATUSES.PROCESSED;
    batch.processedAt = new Date();
    batch.error = null;
    batch.result = { counters, failedSourceActivityIds };
    await batch.save();

    await this.recordBatchOutcome(integration, batch, counters);
  }

  async getSyncStatus(userId: string, providerParam: string): Promise<DeviceSyncStatusResponseDto> {
    const provider = this.resolveProvider(providerParam, { allowWhenDisabled: true });
    const athlete = await this.trainingService.getOrCreateAthlete(userId);
    const integration = await this.integrationModel.findOne({ where: { athleteId: athlete.id, provider } });
    if (!integration) {
      return {
        status: INTEGRATION_STATUSES.DISCONNECTED,
        processed: 0,
        imported: 0,
        failed: 0,
        startedAt: null,
        completedAt: null,
        estimatedCompletion: null,
        error: null,
        lastSyncId: null,
        lastSyncType: null,
        pendingBatches: 0,
        counters: emptyCounters(),
      };
    }
    const [state, pendingBatches] = await Promise.all([
      this.syncStateModel.findOne({ where: { integrationId: integration.id }, order: [['createdAt', 'DESC']] }),
      this.batchModel.count({ where: { integrationId: integration.id, status: PENDING_STATUSES } }),
    ]);
    const lastSync = (integration.metadata as DeviceMetadata).lastSync;
    const counters = lastSync && state && lastSync.syncId === state.cursor ? lastSync.counters : emptyCounters();

    return {
      status: state?.status ?? integration.status,
      processed: state?.processedCount ?? 0,
      imported: state?.importedCount ?? 0,
      failed: state?.failedCount ?? 0,
      startedAt: state ? state.startedAt.toISOString() : null,
      completedAt: state?.completedAt ? state.completedAt.toISOString() : null,
      estimatedCompletion: null,
      error: state?.error ?? integration.lastSyncError,
      lastSyncId: state?.cursor ?? null,
      lastSyncType: state?.syncType ?? null,
      pendingBatches,
      counters,
    };
  }

  // -------------------------------------------------------- profile metrics

  async applyProfileMetrics(
    userId: string,
    providerParam: string,
    dto: DeviceProfileMetricsDto,
  ): Promise<DeviceProfileMetricsResultDto> {
    const provider = this.resolveProvider(providerParam);
    const integration = await this.loadConnected(userId, provider);
    const applied: DeviceProfileMetricsResultDto['applied'] = [];
    const skipped: SkippedProfileMetricDto[] = [];
    const requested: ProfileMetricField[] = [
      ...(dto.weight ? (['weightKg'] as const) : []),
      ...(dto.height ? (['heightCm'] as const) : []),
      ...(dto.sex ? (['sex'] as const) : []),
      ...(dto.birthDate ? (['birthDate'] as const) : []),
      ...(dto.restingHeartRate?.length ? (['restingHeartRate'] as const) : []),
    ];

    if ((integration.metadata as DeviceMetadata).profileSync === false) {
      return { applied, skipped: requested.map((field) => ({ field, reason: 'profile_sync_off' })) };
    }
    const athlete = await this.athleteModel.findByPk(integration.athleteId);
    if (!athlete) {
      throw new EntityNotFoundException('Athlete', integration.athleteId);
    }

    const minMeasuredAt = Date.now() - PROFILE_METRIC_MAX_AGE_DAYS * DAY_MS;
    const candidates: Array<{ field: ProfileMetricField; value: number | string; measuredAt?: Date }> = [];

    if (dto.weight) {
      const measuredAt = new Date(dto.weight.measuredAt);
      const value = Math.round(dto.weight.valueKg * 10) / 10;
      // An old weigh-in still fills an empty profile; it only cannot replace an existing value.
      const tooOld =
        measuredAt.getTime() < minMeasuredAt && athlete.weightKg !== null && athlete.weightKg !== undefined;
      if (tooOld || measuredAt.getTime() > Date.now() + DAY_MS) {
        skipped.push({ field: 'weightKg', reason: 'stale' });
      } else if (value < ATHLETE_RANGES.weightKg.min || value > ATHLETE_RANGES.weightKg.max) {
        skipped.push({ field: 'weightKg', reason: 'out_of_range' });
      } else {
        candidates.push({ field: 'weightKg', value, measuredAt });
      }
    }

    if (dto.height) {
      // Height is measured rarely, so an old sample is still valid; only a future date is rejected.
      const measuredAt = new Date(dto.height.measuredAt);
      const value = Math.round(dto.height.valueCm);
      if (measuredAt.getTime() > Date.now() + DAY_MS) {
        skipped.push({ field: 'heightCm', reason: 'stale' });
      } else if (value < ATHLETE_RANGES.heightCm.min || value > ATHLETE_RANGES.heightCm.max) {
        skipped.push({ field: 'heightCm', reason: 'out_of_range' });
      } else {
        candidates.push({ field: 'heightCm', value, measuredAt });
      }
    }

    // Characteristics have no measurement time: they fill the profile but never replace a manual value.
    if (dto.sex) {
      candidates.push({ field: 'sex', value: dto.sex });
    }
    if (dto.birthDate) {
      const age = ageFromBirthDate(dto.birthDate, new Date().toISOString().slice(0, 10));
      if (age === null || age < ATHLETE_RANGES.ageYears.min || age > ATHLETE_RANGES.ageYears.max) {
        skipped.push({ field: 'birthDate', reason: 'out_of_range' });
      } else {
        candidates.push({ field: 'birthDate', value: dto.birthDate });
      }
    }

    if (dto.restingHeartRate?.length) {
      const recent = dto.restingHeartRate.filter((sample) => Date.parse(`${sample.date}T00:00:00Z`) >= minMeasuredAt);
      const median = restingHeartRateMedian(recent, RESTING_HR_MEDIAN_DAYS, RESTING_HR_MIN_DAYS);
      const range = ATHLETE_RANGES.restingHeartRate;
      if (!median) {
        skipped.push({ field: 'restingHeartRate', reason: 'insufficient_data' });
      } else if (median.bpm < range.min || median.bpm > range.max) {
        skipped.push({ field: 'restingHeartRate', reason: 'out_of_range' });
      } else {
        candidates.push({
          field: 'restingHeartRate',
          value: median.bpm,
          measuredAt: new Date(`${median.latestDate}T00:00:00Z`),
        });
      }
    }

    for (const candidate of candidates) {
      const stored = athlete.fieldSources?.[candidate.field];
      if (!candidate.measuredAt) {
        const current: unknown = athlete[candidate.field];
        if (current === candidate.value) continue;
        if (stored?.source === 'manual' && current !== null && current !== undefined) {
          skipped.push({ field: candidate.field, reason: 'manual_source' });
          continue;
        }
        await this.athleteProfileService.applySourcedValues(athlete.id, provider, {
          [candidate.field]: candidate.value,
        });
        applied.push(candidate.field);
        continue;
      }
      // A manual value stays until Health has a measurement taken after it was entered.
      if (stored?.updatedAt && Date.parse(stored.updatedAt) >= candidate.measuredAt.getTime()) {
        skipped.push({ field: candidate.field, reason: stored.source === 'manual' ? 'manual_source' : 'stale' });
        continue;
      }
      if (stored?.source === 'manual' && !stored.updatedAt) {
        skipped.push({ field: candidate.field, reason: 'manual_source' });
        continue;
      }
      await this.athleteProfileService.applySourcedValues(
        athlete.id,
        provider,
        { [candidate.field]: candidate.value },
        { [candidate.field]: candidate.measuredAt },
      );
      applied.push(candidate.field);
    }

    if (applied.length > 0) {
      integration.lastProfileSyncAt = new Date();
      await integration.save();
    }
    return { applied, skipped };
  }

  // ------------------------------------------------------------------- misc

  async listWorkoutSources(userId: string, workoutId: string): Promise<WorkoutSourcesResponseDto> {
    const athlete = await this.trainingService.getOrCreateAthlete(userId);
    const workout = await this.workoutModel.findOne({
      where: { id: workoutId, athleteId: athlete.id },
      attributes: ['id'],
    });
    if (!workout) {
      throw new EntityNotFoundException('Workout', workoutId);
    }
    const sources = await this.sourceModel.findAll({
      where: { workoutId },
      order: [
        ['isPrimary', 'DESC'],
        ['createdAt', 'ASC'],
      ],
    });
    return {
      items: sources.map((source) => ({
        provider: source.provider,
        isPrimary: source.isPrimary,
        originDevice: source.originDevice,
        originAppId: source.originAppId,
        startedAt: source.startedAt,
      })),
    };
  }

  /** Daily: processed batches hold health data and are not needed after the retention window. */
  async cleanupBatches(): Promise<number> {
    return this.batchModel.destroy({
      where: {
        status: [WEBHOOK_EVENT_STATUSES.PROCESSED, WEBHOOK_EVENT_STATUSES.IGNORED, WEBHOOK_EVENT_STATUSES.FAILED],
        createdAt: { [Op.lt]: new Date(Date.now() - DEVICE_BATCH_RETENTION_DAYS * DAY_MS) },
      },
    });
  }

  // ---------------------------------------------------------------- helpers

  private resolveProvider(value: string, options: { allowWhenDisabled?: boolean } = {}): DeviceProviderName {
    if (!(DEVICE_PROVIDERS as readonly string[]).includes(value)) {
      throw new DomainException(
        'PROVIDER_NOT_SUPPORTED',
        `Provider ${value} is not supported here`,
        HttpStatus.NOT_FOUND,
      );
    }
    if (!options.allowWhenDisabled && this.configService.get<boolean>('integrations.health.enabled') !== true) {
      throw new DomainException(
        'PROVIDER_NOT_SUPPORTED',
        'Apple Health and Health Connect are not available yet',
        HttpStatus.NOT_FOUND,
      );
    }
    return value as DeviceProviderName;
  }

  private async loadConnected(userId: string, provider: DeviceProviderName): Promise<Integration> {
    const athlete = await this.trainingService.getOrCreateAthlete(userId);
    const integration = await this.integrationModel.findOne({ where: { athleteId: athlete.id, provider } });
    if (!integration || integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      throw new DomainException('INTEGRATION_NOT_CONNECTED', `Connect ${provider} first`, HttpStatus.CONFLICT);
    }
    return integration;
  }

  private async markDisconnected(integration: Integration): Promise<void> {
    if (integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      return;
    }
    integration.status = INTEGRATION_STATUSES.DISCONNECTED;
    integration.disconnectedAt = new Date();
    await integration.save();
    this.eventEmitter.emit(
      'integrations.disconnected',
      new IntegrationDisconnectedEvent(integration.id, integration.athleteId, integration.provider),
    );
  }

  private validateBatch(dto: DeviceSyncBatchDto, now: Date): DeviceSyncBatchPayload {
    const seen = new Set<string>();
    const payload: DeviceSyncBatchPayload = { activities: [], deletedSourceActivityIds: [], rejected: [] };
    for (const item of dto.activities) {
      if (seen.has(item.sourceActivityId)) {
        payload.rejected.push({ sourceActivityId: item.sourceActivityId, code: 'DUPLICATE_IN_BATCH' });
        continue;
      }
      seen.add(item.sourceActivityId);
      const check = checkDeviceActivity(item, now);
      if (check.ok) {
        payload.activities.push(check.activity);
      } else {
        payload.rejected.push({ sourceActivityId: item.sourceActivityId, code: check.code });
      }
    }
    payload.deletedSourceActivityIds = [...new Set(dto.deletedSourceActivityIds ?? [])].filter((id) => !seen.has(id));
    return payload;
  }

  private async ensureSyncState(integration: Integration, dto: DeviceSyncBatchDto): Promise<void> {
    const existing = await this.syncStateModel.findOne({
      where: { integrationId: integration.id, cursor: dto.syncId },
    });
    if (existing) {
      return;
    }
    await this.syncStateModel.create({
      integrationId: integration.id,
      syncType: dto.syncType,
      cursor: dto.syncId,
      page: 0,
      startedAt: new Date(),
      status: SYNC_STATUSES.IN_PROGRESS,
    });
  }

  /** Adds batch counters to the session and closes it once the last batch and all before it are processed. */
  private async recordBatchOutcome(
    integration: Integration,
    batch: DeviceSyncBatch,
    counters: DeviceBatchCounters,
  ): Promise<void> {
    const state = await this.syncStateModel.findOne({
      where: { integrationId: integration.id, cursor: batch.syncId },
    });
    const imported =
      counters.created + counters.updated + counters.merged + counters.matchedPlanned + counters.matchedManual;
    if (state) {
      state.page = Math.max(state.page, batch.batchIndex + 1);
      state.processedCount += batch.payload.activities.length + batch.payload.rejected.length;
      state.importedCount += imported;
      state.skippedCount += counters.skipped + counters.rejected;
      state.failedCount += counters.failed;
      await state.save();
    }

    const metadata = { ...(integration.metadata as DeviceMetadata) };
    const previous = metadata.lastSync?.syncId === batch.syncId ? metadata.lastSync.counters : emptyCounters();
    const merged = emptyCounters();
    for (const key of Object.keys(merged) as Array<keyof DeviceBatchCounters>) {
      merged[key] = previous[key] + counters[key];
    }
    metadata.lastSync = { syncId: batch.syncId, syncType: batch.syncType, counters: merged };
    integration.metadata = metadata as Record<string, unknown>;
    integration.changed('metadata', true);

    const athlete = await this.athleteModel.findByPk(integration.athleteId, { attributes: ['id', 'userId'] });
    const userId = athlete?.userId ?? null;

    const [pendingInSession, lastBatch, pendingOverall] = await Promise.all([
      this.batchModel.count({
        where: { integrationId: integration.id, syncId: batch.syncId, status: PENDING_STATUSES },
      }),
      this.batchModel.findOne({
        where: { integrationId: integration.id, syncId: batch.syncId, isLast: true },
        attributes: ['id'],
      }),
      this.batchModel.count({ where: { integrationId: integration.id, status: PENDING_STATUSES } }),
    ]);

    if (pendingOverall === 0 && integration.status !== INTEGRATION_STATUSES.DISCONNECTED) {
      integration.status = INTEGRATION_STATUSES.CONNECTED;
      integration.lastSyncError = null;
    }

    const sessionDone = !!lastBatch && pendingInSession === 0 && state?.status === SYNC_STATUSES.IN_PROGRESS;
    if (sessionDone && state) {
      state.status = SYNC_STATUSES.COMPLETED;
      state.completedAt = new Date();
      await state.save();
      integration.lastSyncAt = new Date();
      if (merged.failed === 0) {
        integration.lastSuccessfulSyncAt = integration.lastSyncAt;
      }
    }
    await integration.save();

    if (userId) {
      this.eventEmitter.emit(
        'integrations.sync_batch_processed',
        new DeviceSyncBatchProcessedEvent(userId, integration.provider, batch.syncId, batch.batchIndex, counters),
      );
      if (sessionDone) {
        this.eventEmitter.emit(
          'integrations.sync_completed',
          new DeviceSyncCompletedEvent(userId, integration.athleteId, integration.provider, batch.syncId, merged),
        );
      }
    }
  }

  private async toItem(integration: Integration): Promise<IntegrationItemResponseDto> {
    const [importedActivitiesCount, pendingBatches] = await Promise.all([
      this.sourceModel.count({ where: { athleteId: integration.athleteId, provider: integration.provider } }),
      this.batchModel.count({ where: { integrationId: integration.id, status: PENDING_STATUSES } }),
    ]);
    return toIntegrationItem(integration.provider, integration, {
      importedActivitiesCount,
      pendingBatches,
      available: this.configService.get<boolean>('integrations.health.enabled') === true,
    });
  }

  private toAccepted(batch: DeviceSyncBatch): DeviceSyncBatchAcceptedDto {
    return {
      syncId: batch.syncId,
      batchId: batch.id,
      accepted: batch.payload.activities.length + batch.payload.deletedSourceActivityIds.length,
      rejected: batch.payload.rejected,
    };
  }
}
