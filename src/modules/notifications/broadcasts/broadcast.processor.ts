import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { NOTIFICATIONS_BROADCAST_JOB, NOTIFICATIONS_BROADCAST_QUEUE } from '../notifications.constants';
import { type BroadcastJob, BroadcastsService } from './broadcasts.service';

@Processor(NOTIFICATIONS_BROADCAST_QUEUE)
export class BroadcastProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastProcessor.name);

  constructor(private readonly broadcastsService: BroadcastsService) {
    super();
  }

  async process(job: Job<BroadcastJob>): Promise<void> {
    if (job.name === NOTIFICATIONS_BROADCAST_JOB) {
      await this.broadcastsService.fanOut(job.data.broadcastId);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<BroadcastJob>, error: Error): Promise<void> {
    this.logger.error(`Broadcast ${job.data.broadcastId} failed: ${error.message}`, error.stack);
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.broadcastsService.markFailed(job.data.broadcastId, error.message);
    }
  }
}
