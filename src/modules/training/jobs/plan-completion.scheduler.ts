import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PLAN_COMPLETION_QUEUE, PlanCompletionJobData } from './plan-completion.constants';

/**
 * Registers the repeatable daily plan-completion job:
 * every day at 03:00 UTC active plans whose end date has passed become
 * completed. Repeat registration is idempotent — BullMQ keeps the existing
 * repeatable job keyed by jobId.
 */
@Injectable()
export class PlanCompletionScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlanCompletionScheduler.name);

  constructor(
    @InjectQueue(PLAN_COMPLETION_QUEUE)
    private readonly queue: Queue<PlanCompletionJobData>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.queue.add(
        'daily-plan-completion',
        { triggeredBy: 'schedule' },
        {
          repeat: { pattern: '0 3 * * *', tz: 'UTC' },
          jobId: 'daily-plan-completion',
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      // Scheduling must not block application startup (e.g. Redis unavailable).
      this.logger.warn(`Failed to schedule plan completion job: ${(error as Error).message}`);
    }
  }
}
