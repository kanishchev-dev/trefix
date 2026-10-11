import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { Op, UniqueConstraintError } from 'sequelize';

import { DomainPayloadTooLargeException } from '@/common/exceptions/domain-exceptions';
import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { AthletesService } from '@/modules/training/athletes/athletes.service';

import {
  DEVICE_BATCH_RETENTION_DAYS,
  DEVICE_SYNC_BATCH_MAX,
  type DeviceProviderName,
  INTEGRATION_STATUSES,
  INTEGRATIONS_QUEUE_NAME,
  JOB_DEVICE_PROCESS_BATCH,
  SYNC_STATUSES,
  WEBHOOK_EVENT_STATUSES,
} from '../constants/integrations.constants';
import { DeviceBatchCounters, DeviceSyncBatch, DeviceSyncBatchPayload } from '../entities/device-sync-batch.entity';
import { Integration } from '../entities/integration.entity';
import { IntegrationSyncState } from '../entities/integration-sync-state.entity';
import { ActivityIngestionService } from '../ingestion/activity-ingestion.service';
import { checkDeviceActivity, toRunningActivity } from './device-activity.rules';
import { DeviceIntegrationLookup } from './device-integration-lookup.service';
import {
  DAY_MS,
  DeviceMetadata,
  emptyCounters,
  OUTCOME_COUNTER,
  PENDING_STATUSES,
  ProcessBatchJobData,
} from './device-integrations.shared';
import { DeviceSyncBatchProcessedEvent, DeviceSyncCompletedEvent } from './device-sync.events';
import { DeviceSyncBatchAcceptedDto, DeviceSyncBatchDto } from './dto/device-sync-batch.dto';
import { DeviceSyncStatusResponseDto } from './dto/device-sync-status.dto';

/**
 * Apple Health and Health Connect have no server API: the app reads the records on the device and pushes them here.
 * Batches are stored first and processed in the integrations queue, so a 202 means the data is safe and the app
 * may move its sync cursor.
 */
@Injectable()
export class DeviceSyncService {
  private readonly logger = new Logger(DeviceSyncService.name);

  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    @InjectModel(DeviceSyncBatch)
    private readonly batchModel: typeof DeviceSyncBatch,
    @InjectModel(IntegrationSyncState)
    private readonly syncStateModel: typeof IntegrationSyncState,
    @InjectQueue(INTEGRATIONS_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly athletesService: AthletesService,
    private readonly ingestion: ActivityIngestionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly lookup: DeviceIntegrationLookup,
  ) {}

  async acceptBatch(
    userId: string,
    providerParam: string,
    dto: DeviceSyncBatchDto,
  ): Promise<DeviceSyncBatchAcceptedDto> {
    const provider = this.lookup.resolveProvider(providerParam);
    const deleted = dto.deletedSourceActivityIds ?? [];
    if (dto.activities.length + deleted.length > DEVICE_SYNC_BATCH_MAX) {
      throw new DomainPayloadTooLargeException(
        'SYNC_BATCH_TOO_LARGE',
        `A batch holds at most ${DEVICE_SYNC_BATCH_MAX} records`,
      );
    }
    const integration = await this.lookup.loadConnected(userId, provider);

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
    const provider = this.lookup.resolveProvider(providerParam, { allowWhenDisabled: true });
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
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

  /** Daily: processed batches hold health data and are not needed after the retention window. */
  async cleanupBatches(): Promise<number> {
    return this.batchModel.destroy({
      where: {
        status: [WEBHOOK_EVENT_STATUSES.PROCESSED, WEBHOOK_EVENT_STATUSES.IGNORED, WEBHOOK_EVENT_STATUSES.FAILED],
        createdAt: { [Op.lt]: new Date(Date.now() - DEVICE_BATCH_RETENTION_DAYS * DAY_MS) },
      },
    });
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

    const athlete = await this.athletesService.findById(integration.athleteId);
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
        INTEGRATIONS_EVENTS.SYNC_BATCH_PROCESSED,
        new DeviceSyncBatchProcessedEvent(userId, integration.provider, batch.syncId, batch.batchIndex, counters),
      );
      if (sessionDone) {
        this.eventEmitter.emit(
          INTEGRATIONS_EVENTS.SYNC_COMPLETED,
          new DeviceSyncCompletedEvent(userId, integration.athleteId, integration.provider, batch.syncId, merged),
        );
      }
    }
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
