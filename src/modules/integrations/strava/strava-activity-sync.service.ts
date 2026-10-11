import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { UniqueConstraintError } from 'sequelize';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { AthletesService } from '@/modules/training/athletes/athletes.service';

import {
  INTEGRATION_STATUSES,
  INTEGRATIONS_QUEUE_NAME,
  JOB_STRAVA_INITIAL_SYNC,
  JOB_STRAVA_PROCESS_WEBHOOK,
  SYNC_STATUSES,
  SYNC_TYPES,
  WEBHOOK_EVENT_STATUSES,
} from '../constants/integrations.constants';
import { StravaWebhookEventDto } from '../dto/strava-webhook.dto';
import { IntegrationSyncStatusResponseDto } from '../dto/sync-status-response.dto';
import { Integration } from '../entities/integration.entity';
import { IntegrationSyncState } from '../entities/integration-sync-state.entity';
import { StravaWebhookEvent } from '../entities/strava-webhook-event.entity';
import { ActivityIngestionService } from '../ingestion/activity-ingestion.service';
import { StravaProvider } from '../providers/strava/strava.provider';
import { StravaTokenService } from './strava-token.service';

/**
 * Strava activities: initial history import, webhook events and on-demand sync.
 */
@Injectable()
export class StravaActivitySyncService {
  private readonly logger = new Logger(StravaActivitySyncService.name);

  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    @InjectModel(IntegrationSyncState)
    private readonly syncStateModel: typeof IntegrationSyncState,
    @InjectModel(StravaWebhookEvent)
    private readonly webhookEventModel: typeof StravaWebhookEvent,
    @InjectQueue(INTEGRATIONS_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly stravaProvider: StravaProvider,
    private readonly athletesService: AthletesService,
    private readonly configService: ConfigService,
    private readonly ingestion: ActivityIngestionService,
    private readonly stravaTokenService: StravaTokenService,
  ) {}

  /** Triggers a manual sync. */
  async triggerStravaSync(actorUserId: string): Promise<IntegrationSyncStatusResponseDto> {
    const athlete = await this.athletesService.getOrCreateAthlete(actorUserId);
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
    const athlete = await this.athletesService.getOrCreateAthlete(actorUserId);
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

    await this.stravaTokenService.ensureValidAccessToken(integration);

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
          await this.stravaTokenService.ensureValidAccessToken(integration);

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

    await this.stravaTokenService.ensureValidAccessToken(integration);
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
}
