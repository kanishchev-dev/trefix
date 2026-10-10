import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  INTEGRATIONS_QUEUE_NAME,
  JOB_DEVICE_BATCHES_CLEANUP,
  JOB_STRAVA_PROFILE_SYNC_ALL,
} from './constants/integrations.constants';

/**
 * Registers daily jobs, idempotent by jobId: Strava profile sync (weight, sex,
 * shoes) at 04:00 UTC and purge of old device batches at 03:30 UTC.
 */
@Injectable()
export class IntegrationsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(IntegrationsScheduler.name);

  constructor(@InjectQueue(INTEGRATIONS_QUEUE_NAME) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.queue.add(
        JOB_STRAVA_PROFILE_SYNC_ALL,
        {},
        {
          repeat: { pattern: '0 4 * * *', tz: 'UTC' },
          jobId: JOB_STRAVA_PROFILE_SYNC_ALL,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      this.logger.warn(`Failed to schedule Strava profile sync: ${(error as Error).message}`);
    }
    try {
      await this.queue.add(
        JOB_DEVICE_BATCHES_CLEANUP,
        {},
        {
          repeat: { pattern: '30 3 * * *', tz: 'UTC' },
          jobId: JOB_DEVICE_BATCHES_CLEANUP,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      this.logger.warn(`Failed to schedule device batch cleanup: ${(error as Error).message}`);
    }
  }
}
