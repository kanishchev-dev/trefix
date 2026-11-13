import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

import { ANALYTICS_SNAPSHOT_CRON, ANALYTICS_SNAPSHOT_JOB, ANALYTICS_SNAPSHOT_QUEUE } from './analytics.constants';

/** Registers the nightly analytics snapshot (idempotent: BullMQ keys it by jobId). */
@Injectable()
export class AnalyticsSnapshotScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnalyticsSnapshotScheduler.name);

  constructor(@InjectQueue(ANALYTICS_SNAPSHOT_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.queue.add(
        ANALYTICS_SNAPSHOT_JOB,
        {},
        {
          repeat: { pattern: ANALYTICS_SNAPSHOT_CRON, tz: 'UTC' },
          jobId: ANALYTICS_SNAPSHOT_JOB,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      // Scheduling must not block application startup (e.g. Redis unavailable).
      this.logger.warn(`Failed to schedule analytics snapshot job: ${(error as Error).message}`);
    }
  }
}
