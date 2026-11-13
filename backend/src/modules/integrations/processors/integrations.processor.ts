import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { DeviceSyncService } from '@/modules/integrations/device/device-sync.service';
import { StravaActivitySyncService } from '@/modules/integrations/strava/strava-activity-sync.service';
import { StravaProfileSyncService } from '@/modules/integrations/strava/strava-profile-sync.service';

import {
  INTEGRATIONS_QUEUE_NAME,
  JOB_DEVICE_BATCHES_CLEANUP,
  JOB_DEVICE_PROCESS_BATCH,
  JOB_STRAVA_FETCH_ACTIVITY,
  JOB_STRAVA_INITIAL_SYNC,
  JOB_STRAVA_PROCESS_WEBHOOK,
  JOB_STRAVA_PROFILE_SYNC,
  JOB_STRAVA_PROFILE_SYNC_ALL,
} from '../constants/integrations.constants';
import { ProcessBatchJobData } from '../device/device-integrations.shared';

export interface InitialSyncJobData {
  integrationId: string;
}

export interface ProcessWebhookJobData {
  webhookEventId: string;
}

export interface FetchActivityJobData {
  integrationId: string;
  activityId: string;
}

/**
 * Concurrency stays at the default of 1: ingestion relies on jobs of one
 * athlete never running in parallel (Strava webhooks and device batches alike).
 */
@Injectable()
@Processor(INTEGRATIONS_QUEUE_NAME)
export class IntegrationsProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationsProcessor.name);

  constructor(
    private readonly stravaActivitySync: StravaActivitySyncService,
    private readonly stravaProfileSync: StravaProfileSyncService,
    private readonly deviceSync: DeviceSyncService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case JOB_STRAVA_INITIAL_SYNC: {
        const { integrationId } = job.data as InitialSyncJobData;
        return this.stravaActivitySync.executeInitialSync(integrationId);
      }

      case JOB_STRAVA_PROCESS_WEBHOOK: {
        const { webhookEventId } = job.data as ProcessWebhookJobData;
        return this.stravaActivitySync.processWebhookEvent(webhookEventId);
      }

      case JOB_STRAVA_FETCH_ACTIVITY: {
        const { integrationId, activityId } = job.data as FetchActivityJobData;
        return this.stravaActivitySync.fetchAndImportSingleActivity(integrationId, activityId);
      }

      case JOB_STRAVA_PROFILE_SYNC: {
        const { integrationId } = job.data as InitialSyncJobData;
        return this.stravaProfileSync.syncStravaProfile(integrationId);
      }

      case JOB_STRAVA_PROFILE_SYNC_ALL:
        return this.stravaProfileSync.syncAllStravaProfiles();

      case JOB_DEVICE_PROCESS_BATCH: {
        const { batchId } = job.data as ProcessBatchJobData;
        return this.deviceSync.processBatch(batchId);
      }

      case JOB_DEVICE_BATCHES_CLEANUP:
        return this.deviceSync.cleanupBatches();

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
    }
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.name} (id: ${job.id}) failed: ${error.message}`, error.stack);
  }
}
