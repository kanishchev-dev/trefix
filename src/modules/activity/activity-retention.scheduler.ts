import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

import { ACTIVITY_RETENTION_JOB, ACTIVITY_RETENTION_QUEUE } from './activity.constants';

/** Registers the daily retention job (idempotent: BullMQ keys it by jobId). */
@Injectable()
export class ActivityRetentionScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(ActivityRetentionScheduler.name);

  constructor(@InjectQueue(ACTIVITY_RETENTION_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.queue.add(
        ACTIVITY_RETENTION_JOB,
        {},
        {
          repeat: { pattern: '15 2 * * *', tz: 'UTC' },
          jobId: ACTIVITY_RETENTION_JOB,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      // Scheduling must not block application startup (e.g. Redis unavailable).
      this.logger.warn(`Failed to schedule activity retention job: ${(error as Error).message}`);
    }
  }
}
