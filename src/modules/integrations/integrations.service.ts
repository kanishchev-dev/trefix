import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { Op, UniqueConstraintError } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { decryptToken, encryptToken } from '@/common/utils/encryption.util';

import { AthleteProfileService } from '../training/athletes/athlete-profile.service';
import { Athlete } from '../training/entities/athlete.entity';
import { Workout } from '../training/entities/workout.entity';
import { GearService } from '../training/gear/gear.service';
import { TrainingService } from '../training/training.service';
import { UserPreferencesService } from '../users/preferences/user-preferences.service';
import {
  DEVICE_PROVIDERS,
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUSES,
  INTEGRATIONS_QUEUE_NAME,
  JOB_STRAVA_INITIAL_SYNC,
  JOB_STRAVA_PROCESS_WEBHOOK,
  JOB_STRAVA_PROFILE_SYNC,
  OAUTH_ACCESS_TOKEN_REFRESH_MARGIN_MS,
  STRAVA_PROFILE_SCOPE,
  SYNC_STATUSES,
  SYNC_TYPES,
  WEBHOOK_EVENT_STATUSES,
} from './constants/integrations.constants';
import { IntegrationItemResponseDto, IntegrationsListResponseDto } from './dto/integration-response.dto';
import { StravaConnectResponseDto } from './dto/strava-connect-response.dto';
import { StravaWebhookEventDto } from './dto/strava-webhook.dto';
import { IntegrationSyncStatusResponseDto } from './dto/sync-status-response.dto';
import { DeviceSyncBatch } from './entities/device-sync-batch.entity';
import { Integration } from './entities/integration.entity';
import { IntegrationSyncState } from './entities/integration-sync-state.entity';
import { StravaWebhookEvent } from './entities/strava-webhook-event.entity';
import { WorkoutSource } from './entities/workout-source.entity';
import { IntegrationConnectedEvent } from './events/integration-connected.event';
import { IntegrationDisconnectedEvent } from './events/integration-disconnected.event';
import { IntegrationOAuthStateInvalidException } from './exceptions/integration-oauth-state-invalid.exception';
import { IntegrationReauthorizationRequiredException } from './exceptions/integration-reauthorization-required.exception';
import { ActivityIngestionService } from './ingestion/activity-ingestion.service';
import { toIntegrationItem } from './integration-item.mapper';
import { StravaProvider } from './providers/strava/strava.provider';
import { OAuthStateStore } from './services/oauth-state.store';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    @InjectModel(IntegrationSyncState)
    private readonly syncStateModel: typeof IntegrationSyncState,
    @InjectModel(StravaWebhookEvent)
    private readonly webhookEventModel: typeof StravaWebhookEvent,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    @InjectQueue(INTEGRATIONS_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly stravaProvider: StravaProvider,
    private readonly trainingService: TrainingService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly oauthStateStore: OAuthStateStore,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly gearService: GearService,
    private readonly preferencesService: UserPreferencesService,
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    private readonly ingestion: ActivityIngestionService,
    @InjectModel(WorkoutSource)
    private readonly workoutSourceModel: typeof WorkoutSource,
    @InjectModel(DeviceSyncBatch)
    private readonly deviceBatchModel: typeof DeviceSyncBatch,
  ) {}

  private get encryptionKey(): string {
    return this.configService.getOrThrow<string>('integrations.encryptionKey');
  }

  /** Lists every provider with its connection status for the user. */
  async listIntegrations(actorUserId: string): Promise<IntegrationsListResponseDto> {
    const athlete = await this.trainingService.getOrCreateAthlete(actorUserId);
    const integrations = await this.integrationModel.findAll({
      where: { athleteId: athlete.id },
    });
    const healthEnabled = this.configService.get<boolean>('integrations.health.enabled') === true;

    const items: IntegrationItemResponseDto[] = await Promise.all(
      INTEGRATION_PROVIDERS.map(async (provider) => {
        const found = integrations.find((entry) => entry.provider === provider) ?? null;
        const isDevice = (DEVICE_PROVIDERS as readonly string[]).includes(provider);
        const importedActivitiesCount = found
          ? await this.workoutSourceModel.count({ where: { athleteId: athlete.id, provider } })
          : 0;
        const pendingBatches =
          found && isDevice
            ? await this.deviceBatchModel.count({
                where: {
                  integrationId: found.id,
                  status: [WEBHOOK_EVENT_STATUSES.PENDING, WEBHOOK_EVENT_STATUSES.PROCESSING],
                },
              })
            : 0;
        return toIntegrationItem(provider, found, {
          importedActivitiesCount,
          pendingBatches,
          available: provider === 'garmin' ? false : isDevice ? healthEnabled : true,
        });
      }),
    );

    return { items };
  }

  /** Returns Strava integration details for the authenticated user. */
  async getStravaIntegration(actorUserId: string): Promise<IntegrationItemResponseDto> {
    const list = await this.listIntegrations(actorUserId);
    const strava = list.items.find((item) => item.provider === 'strava');
    if (!strava) {
      return {
        provider: 'strava',
        status: INTEGRATION_STATUSES.DISCONNECTED,
        connectedAt: null,
        lastSyncedAt: null,
        externalUserId: null,
        importedActivitiesCount: 0,
        profileAccess: false,
        lastProfileSyncAt: null,
        available: true,
        profileSync: null,
        pendingBatches: 0,
        scopes: [],
      };
    }
    return strava;
  }

  /** Initiates Strava OAuth connection flow. */
  async initiateStravaConnect(actorUserId: string): Promise<StravaConnectResponseDto> {
    const athlete = await this.trainingService.getOrCreateAthlete(actorUserId);
    const state = await this.oauthStateStore.issue({ athleteId: athlete.id, purpose: 'connect' });
    const authUrl = this.stravaProvider.generateAuthUrl(athlete.id, state);

    return { authUrl, state };
  }

  /** Re-authorization URL that adds `profile:read_all` (weight, sex, shoes) to an existing connection. */
  async requestStravaProfileAccess(actorUserId: string): Promise<{ authorizeUrl: string; state: string }> {
    const athlete = await this.trainingService.getOrCreateAthlete(actorUserId);
    await this.loadConnectedStravaOrThrow(athlete.id);
    const state = await this.oauthStateStore.issue({ athleteId: athlete.id, purpose: 'profile' });
    return { authorizeUrl: this.stravaProvider.generateProfileAuthUrl(state), state };
  }

  /** Queues a profile sync outside of the daily schedule. */
  async triggerStravaProfileSync(actorUserId: string): Promise<{ status: 'queued' }> {
    const athlete = await this.trainingService.getOrCreateAthlete(actorUserId);
    const integration = await this.loadConnectedStravaOrThrow(athlete.id);
    if (!this.hasProfileScope(integration)) {
      throw new DomainException(
        'STRAVA_PROFILE_ACCESS_REQUIRED',
        'Allow Strava to share your profile first',
        HttpStatus.CONFLICT,
      );
    }
    await this.enqueueProfileSync(integration.id);
    return { status: 'queued' };
  }

  /**
   * Pulls weight, sex and shoes from Strava. Fields the user edited by hand
   * are left alone; nothing happens when profile sync is off in preferences.
   */
  async syncStravaProfile(integrationId: string): Promise<void> {
    const integration = await this.integrationModel.findByPk(integrationId);
    if (
      !integration ||
      integration.status === INTEGRATION_STATUSES.DISCONNECTED ||
      !this.hasProfileScope(integration)
    ) {
      return;
    }
    const athlete = await this.athleteModel.findByPk(integration.athleteId, { attributes: ['id', 'userId'] });
    if (!athlete) {
      return;
    }
    const preferences = await this.preferencesService.getEntity(athlete.userId);
    if (!preferences.stravaProfileSync) {
      return;
    }

    await this.ensureValidAccessToken(integration);
    const profile = await this.stravaProvider.fetchAthleteProfile(integration);
    await this.athleteProfileService.applySourcedValues(athlete.id, 'strava', {
      weightKg: profile.weightKg ?? undefined,
      sex: profile.sex ?? undefined,
    });
    await this.gearService.upsertExternalShoes(athlete.id, profile.shoes);

    integration.lastProfileSyncAt = new Date();
    await integration.save();
  }

  /** Daily job: queues a profile sync for every Strava connection that granted profile access. */
  async syncAllStravaProfiles(): Promise<number> {
    const integrations = await this.integrationModel.findAll({
      where: { provider: 'strava', status: { [Op.ne]: INTEGRATION_STATUSES.DISCONNECTED } },
      attributes: ['id', 'scopes'],
    });
    const eligible = integrations.filter((integration) => this.hasProfileScope(integration));
    for (const integration of eligible) {
      await this.enqueueProfileSync(integration.id);
    }
    return eligible.length;
  }

  /** Revokes Strava access of a user whose account is being deleted. */
  async revokeAllForUser(userId: string): Promise<void> {
    const athlete = await this.athleteModel.findOne({ where: { userId }, attributes: ['id'] });
    if (!athlete) {
      return;
    }
    const integrations = await this.integrationModel.findAll({ where: { athleteId: athlete.id } });
    for (const integration of integrations) {
      if (integration.provider === 'strava') {
        await this.stravaProvider.revokeAccess(integration);
      }
      integration.status = INTEGRATION_STATUSES.DISCONNECTED;
      integration.disconnectedAt = new Date();
      integration.accessTokenEncrypted = null;
      integration.refreshTokenEncrypted = null;
      await integration.save();
    }
  }

  private hasProfileScope(integration: Integration): boolean {
    return Array.isArray(integration.scopes) && integration.scopes.includes(STRAVA_PROFILE_SCOPE);
  }

  private async enqueueProfileSync(integrationId: string): Promise<void> {
    await this.queue.add(
      JOB_STRAVA_PROFILE_SYNC,
      { integrationId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
    );
  }

  private async loadConnectedStravaOrThrow(athleteId: string): Promise<Integration> {
    const integration = await this.integrationModel.findOne({ where: { athleteId, provider: 'strava' } });
    if (!integration || integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      throw new DomainException('STRAVA_NOT_CONNECTED', 'Connect Strava first', HttpStatus.CONFLICT);
    }
    return integration;
  }

  /** Handles OAuth callback from Strava. */
  async handleStravaCallback(
    code: string,
    state: string,
    grantedScope?: string,
  ): Promise<{ success: boolean; message: string }> {
    const stored = await this.oauthStateStore.consume(state);
    if (!stored) {
      throw new IntegrationOAuthStateInvalidException();
    }

    const grantedScopes = grantedScope
      ? grantedScope
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean)
      : undefined;
    const tokens = await this.stravaProvider.exchangeCode(code, grantedScopes);
    const athleteId = stored.athleteId;

    let integration = await this.integrationModel.findOne({
      where: { athleteId, provider: 'strava' },
      paranoid: false,
    });

    const encryptedAccessToken = encryptToken(tokens.accessToken, this.encryptionKey);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken, this.encryptionKey);

    if (integration) {
      if (integration.deletedAt) {
        await integration.restore();
      }
      integration.status = INTEGRATION_STATUSES.CONNECTED;
      integration.externalUserId = tokens.externalUserId;
      integration.accessTokenEncrypted = encryptedAccessToken;
      integration.refreshTokenEncrypted = encryptedRefreshToken;
      integration.accessTokenExpiresAt = tokens.expiresAt;
      integration.scopes = tokens.scopes;
      integration.connectedAt = new Date();
      integration.disconnectedAt = null;
      integration.lastSyncError = null;
      await integration.save();
    } else {
      integration = await this.integrationModel.create({
        athleteId,
        provider: 'strava',
        status: INTEGRATION_STATUSES.CONNECTED,
        externalUserId: tokens.externalUserId,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        accessTokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        connectedAt: new Date(),
      });
    }

    if (tokens.scopes.includes(STRAVA_PROFILE_SCOPE)) {
      await this.enqueueProfileSync(integration.id);
    }
    if (stored.purpose === 'profile') {
      // Only the scope changed: activities are already imported.
      return { success: true, message: 'Strava profile access granted.' };
    }

    // Create sync state record
    await this.syncStateModel.create({
      integrationId: integration.id,
      syncType: SYNC_TYPES.INITIAL,
      startedAt: new Date(),
      status: SYNC_STATUSES.IN_PROGRESS,
    });

    // Enqueue initial sync job
    await this.queue.add(
      JOB_STRAVA_INITIAL_SYNC,
      { integrationId: integration.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.eventEmitter.emit(
      'integrations.connected',
      new IntegrationConnectedEvent(integration.id, athleteId, 'strava'),
    );

    return {
      success: true,
      message: 'Strava connected successfully. Historical sync started in background.',
    };
  }

  /** Disconnects Strava integration for an athlete user. */
  async disconnectStrava(actorUserId: string): Promise<{ success: boolean }> {
    const athlete = await this.trainingService.getOrCreateAthlete(actorUserId);
    const integration = await this.integrationModel.findOne({
      where: { athleteId: athlete.id, provider: 'strava' },
    });

    if (!integration) {
      throw new EntityNotFoundException('Integration', 'strava');
    }

    await this.stravaProvider.revokeAccess(integration);

    integration.status = INTEGRATION_STATUSES.DISCONNECTED;
    integration.disconnectedAt = new Date();
    integration.accessTokenEncrypted = null;
    integration.refreshTokenEncrypted = null;
    await integration.save();

    this.eventEmitter.emit(
      'integrations.disconnected',
      new IntegrationDisconnectedEvent(integration.id, athlete.id, 'strava'),
    );

    return { success: true };
  }

  /** Triggers a manual sync. */
  async triggerStravaSync(actorUserId: string): Promise<IntegrationSyncStatusResponseDto> {
    const athlete = await this.trainingService.getOrCreateAthlete(actorUserId);
    const integration = await this.integrationModel.findOne({
      where: { athleteId: athlete.id, provider: 'strava' },
    });

    if (!integration || integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      throw new EntityNotFoundException('Integration', 'strava');
    }

    integration.status = INTEGRATION_STATUSES.SYNCING;
    await integration.save();

    const syncState = await this.syncStateModel.create({
      integrationId: integration.id,
      syncType: SYNC_TYPES.MANUAL,
      startedAt: new Date(),
      status: SYNC_STATUSES.IN_PROGRESS,
    });

    await this.queue.add(
      JOB_STRAVA_INITIAL_SYNC,
      { integrationId: integration.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    return {
      status: 'syncing',
      processed: 0,
      imported: 0,
      failed: 0,
      startedAt: syncState.startedAt.toISOString(),
      completedAt: null,
      estimatedCompletion: null,
      error: null,
    };
  }

  /** Gets sync status for Strava integration. */
  async getStravaSyncStatus(actorUserId: string): Promise<IntegrationSyncStatusResponseDto> {
    const athlete = await this.trainingService.getOrCreateAthlete(actorUserId);
    const integration = await this.integrationModel.findOne({
      where: { athleteId: athlete.id, provider: 'strava' },
    });

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
      };
    }

    const latestSyncState = await this.syncStateModel.findOne({
      where: { integrationId: integration.id },
      order: [['createdAt', 'DESC']],
    });

    return {
      status: latestSyncState ? latestSyncState.status : integration.status,
      processed: latestSyncState ? latestSyncState.processedCount : 0,
      imported: latestSyncState ? latestSyncState.importedCount : 0,
      failed: latestSyncState ? latestSyncState.failedCount : 0,
      startedAt: latestSyncState ? latestSyncState.startedAt.toISOString() : null,
      completedAt: latestSyncState?.completedAt ? latestSyncState.completedAt.toISOString() : null,
      estimatedCompletion: null,
      error: latestSyncState?.error ?? integration.lastSyncError,
    };
  }

  /** Executes initial / backfill sync across paged API requests. */
  async executeInitialSync(integrationId: string): Promise<void> {
    const integration = await this.integrationModel.findByPk(integrationId);
    if (!integration || integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      return;
    }

    await this.ensureValidAccessToken(integration);

    const syncState = await this.syncStateModel.findOne({
      where: { integrationId, status: SYNC_STATUSES.IN_PROGRESS },
      order: [['createdAt', 'DESC']],
    });

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    let page = syncState ? syncState.page : 1;
    let hasMore = true;
    let processedCount = syncState ? syncState.processedCount : 0;
    let importedCount = syncState ? syncState.importedCount : 0;
    let skippedCount = syncState ? syncState.skippedCount : 0;
    let failedCount = syncState ? syncState.failedCount : 0;

    try {
      while (hasMore) {
        const activities = await this.stravaProvider.fetchActivities(integration, {
          page,
          perPage: 50,
          after: twelveMonthsAgo,
        });

        if (activities.length === 0) {
          hasMore = false;
          break;
        }

        for (const activity of activities) {
          processedCount += 1;
          try {
            const { outcome } = await this.ingestion.ingest(activity);
            if (!outcome.startsWith('skipped')) {
              importedCount += 1;
            } else {
              skippedCount += 1;
            }
          } catch (err) {
            this.logger.error(`Error importing activity ${activity.sourceActivityId}: ${err}`);
            failedCount += 1;
          }
        }

        page += 1;
        if (syncState) {
          syncState.page = page;
          syncState.processedCount = processedCount;
          syncState.importedCount = importedCount;
          syncState.skippedCount = skippedCount;
          syncState.failedCount = failedCount;
          await syncState.save();
        }

        if (activities.length < 50) {
          hasMore = false;
        }
      }

      integration.status = INTEGRATION_STATUSES.CONNECTED;
      integration.lastSyncAt = new Date();
      integration.lastSuccessfulSyncAt = new Date();
      integration.lastSyncError = null;
      await integration.save();

      if (syncState) {
        syncState.status = SYNC_STATUSES.COMPLETED;
        syncState.completedAt = new Date();
        await syncState.save();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Initial sync failed for integration ${integrationId}: ${err.message}`, err.stack);
      integration.status = INTEGRATION_STATUSES.ERROR;
      integration.lastSyncError = err.message;
      await integration.save();

      if (syncState) {
        syncState.status = SYNC_STATUSES.FAILED;
        syncState.error = err.message;
        await syncState.save();
      }
      throw err;
    }
  }

  /** Ingests incoming webhook event and enqueues job. */
  async handleWebhookIngestion(payload: StravaWebhookEventDto): Promise<{ status: string }> {
    // Strava does not sign webhook calls; the subscription id is the only proof the
    // event comes from our own subscription. Answer 200 anyway so nothing is retried.
    const expectedSubscriptionId = this.configService.get<string>('integrations.strava.webhookSubscriptionId');
    if (expectedSubscriptionId && String(payload.subscription_id) !== expectedSubscriptionId) {
      this.logger.warn(`Ignoring webhook for foreign subscription ${payload.subscription_id}`);
      return { status: 'ignored' };
    }

    const fingerprint = `${payload.subscription_id}:${payload.object_type}:${payload.object_id}:${payload.aspect_type}:${payload.event_time}`;

    const existing = await this.webhookEventModel.findOne({ where: { fingerprint } });
    if (existing) {
      this.logger.log(`Webhook event ${fingerprint} already ingested, skipping.`);
      return { status: 'already_received' };
    }

    let webhookEvent: StravaWebhookEvent;
    try {
      webhookEvent = await this.webhookEventModel.create({
        subscriptionId: String(payload.subscription_id),
        objectType: payload.object_type,
        objectId: String(payload.object_id),
        aspectType: payload.aspect_type,
        ownerId: String(payload.owner_id),
        eventTime: payload.event_time,
        updates: payload.updates || {},
        fingerprint,
        receivedAt: new Date(),
        status: WEBHOOK_EVENT_STATUSES.PENDING,
      });
    } catch (error) {
      // Strava redelivers events; a parallel delivery may win the unique fingerprint.
      if (error instanceof UniqueConstraintError) {
        return { status: 'already_received' };
      }
      throw error;
    }

    await this.queue.add(JOB_STRAVA_PROCESS_WEBHOOK, { webhookEventId: webhookEvent.id });

    return { status: 'queued' };
  }

  /** Asynchronously processes webhook event. */
  async processWebhookEvent(webhookEventId: string): Promise<void> {
    const event = await this.webhookEventModel.findByPk(webhookEventId);
    if (!event || event.status === WEBHOOK_EVENT_STATUSES.PROCESSED) {
      return;
    }

    event.status = WEBHOOK_EVENT_STATUSES.PROCESSING;
    event.attempts += 1;
    await event.save();

    try {
      if (event.objectType === 'athlete' && event.aspectType === 'update') {
        if (event.updates?.authorized === 'false' || event.updates?.authorized === false) {
          await this.handleAthleteDeauthorize(event.ownerId);
        }
      } else if (event.objectType === 'activity') {
        const integration = await this.integrationModel.findOne({
          where: { externalUserId: event.ownerId, provider: 'strava' },
        });

        if (integration && integration.status !== INTEGRATION_STATUSES.DISCONNECTED) {
          await this.ensureValidAccessToken(integration);

          if (event.aspectType === 'create' || event.aspectType === 'update') {
            const activity = await this.stravaProvider.fetchActivity(integration, event.objectId);
            if (activity) {
              await this.ingestion.ingest(activity);
            }
          } else if (event.aspectType === 'delete') {
            await this.ingestion.removeSource(integration.athleteId, 'strava', event.objectId);
          }
        }
      }

      event.status = WEBHOOK_EVENT_STATUSES.PROCESSED;
      event.processedAt = new Date();
      await event.save();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to process webhook event ${webhookEventId}: ${err.message}`, err.stack);
      event.status = WEBHOOK_EVENT_STATUSES.FAILED;
      event.error = err.message;
      await event.save();
      throw err;
    }
  }

  /** Fetches single activity and imports it. */
  async fetchAndImportSingleActivity(integrationId: string, activityId: string): Promise<void> {
    const integration = await this.integrationModel.findByPk(integrationId);
    if (!integration || integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      return;
    }

    await this.ensureValidAccessToken(integration);
    const activity = await this.stravaProvider.fetchActivity(integration, activityId);
    if (activity) {
      await this.ingestion.ingest(activity);
    }
  }

  /** Handles deauthorization webhook event. */
  private async handleAthleteDeauthorize(externalUserId: string): Promise<void> {
    const integrations = await this.integrationModel.findAll({
      where: { externalUserId, provider: 'strava' },
    });

    for (const integration of integrations) {
      integration.status = INTEGRATION_STATUSES.DISCONNECTED;
      integration.disconnectedAt = new Date();
      integration.accessTokenEncrypted = null;
      integration.refreshTokenEncrypted = null;
      await integration.save();
    }
  }

  /** Ensures access token is valid, refreshing if expired. */
  private async ensureValidAccessToken(integration: Integration): Promise<void> {
    const now = new Date();
    if (
      integration.accessTokenExpiresAt &&
      integration.accessTokenExpiresAt.getTime() > now.getTime() + OAUTH_ACCESS_TOKEN_REFRESH_MARGIN_MS
    ) {
      return;
    }

    if (!integration.refreshTokenEncrypted) {
      integration.status = INTEGRATION_STATUSES.REAUTHORIZATION_REQUIRED;
      await integration.save();
      throw new IntegrationReauthorizationRequiredException();
    }

    const currentRefreshToken = decryptToken(integration.refreshTokenEncrypted, this.encryptionKey);
    const newTokens = await this.stravaProvider.refreshToken(currentRefreshToken);

    integration.accessTokenEncrypted = encryptToken(newTokens.accessToken, this.encryptionKey);
    integration.refreshTokenEncrypted = encryptToken(newTokens.refreshToken, this.encryptionKey);
    integration.accessTokenExpiresAt = newTokens.expiresAt;
    await integration.save();
  }
}
