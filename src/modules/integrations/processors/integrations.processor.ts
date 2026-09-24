import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  INTEGRATIONS_QUEUE_NAME,
  JOB_STRAVA_FETCH_ACTIVITY,
  JOB_STRAVA_INITIAL_SYNC,
  JOB_STRAVA_PROCESS_WEBHOOK,
} from '../constants/integrations.constants';
import { IntegrationsService } from '../integrations.service';

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

@Injectable()
@Processor(INTEGRATIONS_QUEUE_NAME)
export class IntegrationsProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationsProcessor.name);

  constructor(private readonly integrationsService: IntegrationsService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case JOB_STRAVA_INITIAL_SYNC: {
        const { integrationId } = job.data as InitialSyncJobData;
        return this.integrationsService.executeInitialSync(integrationId);
      }

      case JOB_STRAVA_PROCESS_WEBHOOK: {
        const { webhookEventId } = job.data as ProcessWebhookJobData;
        return this.integrationsService.processWebhookEvent(webhookEventId);
      }

      case JOB_STRAVA_FETCH_ACTIVITY: {
        const { integrationId, activityId } = job.data as FetchActivityJobData;
        return this.integrationsService.fetchAndImportSingleActivity(integrationId, activityId);
      }

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
