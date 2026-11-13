import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  NOTIFICATIONS_DELIVER_JOB,
  NOTIFICATIONS_DELIVERY_QUEUE,
  NOTIFICATIONS_RECEIPTS_JOB,
} from '../notifications.constants';
import { NotificationDeliveryService } from './notification-delivery.service';
import type { NotificationDeliveryJob } from './notification-delivery.types';

@Processor(NOTIFICATIONS_DELIVERY_QUEUE)
export class NotificationDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(private readonly deliveryService: NotificationDeliveryService) {
    super();
  }

  async process(job: Job<NotificationDeliveryJob>): Promise<void> {
    if (job.name === NOTIFICATIONS_DELIVER_JOB) {
      await this.deliveryService.deliver(job.data.deliveryId);
    } else if (job.name === NOTIFICATIONS_RECEIPTS_JOB) {
      await this.deliveryService.checkReceipts(job.data.deliveryId);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationDeliveryJob>, error: Error): Promise<void> {
    this.logger.error(`Notification job ${job.name} ${job.id} failed: ${error.message}`, error.stack);
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted && job.name === NOTIFICATIONS_DELIVER_JOB) {
      await this.deliveryService.markFailed(job.data.deliveryId);
    }
  }
}
