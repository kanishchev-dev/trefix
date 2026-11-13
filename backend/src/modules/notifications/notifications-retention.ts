import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import {
  NOTIFICATIONS_RETENTION_DAYS,
  NOTIFICATIONS_RETENTION_JOB,
  NOTIFICATIONS_RETENTION_QUEUE,
} from './notifications.constants';
import { NotificationsService } from './notifications.service';

const DAY_MS = 86_400_000;

/** Registers the daily cleanup of old inbox entries (idempotent: keyed by jobId). */
@Injectable()
export class NotificationsRetentionScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsRetentionScheduler.name);

  constructor(@InjectQueue(NOTIFICATIONS_RETENTION_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.queue.add(
        NOTIFICATIONS_RETENTION_JOB,
        {},
        {
          repeat: { pattern: '45 2 * * *', tz: 'UTC' },
          jobId: NOTIFICATIONS_RETENTION_JOB,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      // Scheduling must not block application startup (e.g. Redis unavailable).
      this.logger.warn(`Failed to schedule notifications retention job: ${(error as Error).message}`);
    }
  }
}

@Processor(NOTIFICATIONS_RETENTION_QUEUE)
export class NotificationsRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsRetentionProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== NOTIFICATIONS_RETENTION_JOB) {
      return;
    }
    const removed = await this.notificationsService.purgeOlderThan(
      new Date(Date.now() - NOTIFICATIONS_RETENTION_DAYS * DAY_MS),
    );
    this.logger.log(`Removed ${removed} notifications older than ${NOTIFICATIONS_RETENTION_DAYS} days`);
  }
}
