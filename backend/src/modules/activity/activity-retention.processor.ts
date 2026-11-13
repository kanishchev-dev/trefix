import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ACTIVITY_RETENTION_QUEUE } from './activity.constants';
import { ActivityService } from './activity.service';

/** Nightly removal of expired history entries; idempotent. */
@Processor(ACTIVITY_RETENTION_QUEUE)
export class ActivityRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityRetentionProcessor.name);

  constructor(private readonly activityService: ActivityService) {
    super();
  }

  async process(): Promise<{ removed: number }> {
    return { removed: await this.activityService.removeExpired(new Date()) };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Activity retention job ${job?.id ?? 'unknown'} failed: ${error.message}`, error.stack);
  }
}
