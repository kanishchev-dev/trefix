import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

import { INTEGRATIONS_QUEUE_NAME, JOB_STRAVA_PROFILE_SYNC_ALL } from './constants/integrations.constants';

/** Registers the daily Strava profile sync (weight, sex, shoes) at 04:00 UTC; idempotent by jobId. */
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
  }
}
