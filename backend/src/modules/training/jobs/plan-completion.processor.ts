import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PlanLifecycleService } from '../plans/plan-lifecycle.service';
import { PLAN_COMPLETION_QUEUE, PlanCompletionJobData } from './plan-completion.constants';

/**
 * Nightly completion of ended plans. Idempotent: the transition only applies
 * to plans that are still active when processed.
 */
@Processor(PLAN_COMPLETION_QUEUE)
@Injectable()
export class PlanCompletionProcessor extends WorkerHost {
  private readonly logger = new Logger(PlanCompletionProcessor.name);

  constructor(private readonly lifecycleService: PlanLifecycleService) {
    super();
  }

  async process(job: Job<PlanCompletionJobData>): Promise<{ completed: number }> {
    this.logger.debug(`Running plan completion job ${job.id ?? 'manual'}`);
    return { completed: await this.lifecycleService.completeEndedPlans() };
  }

  @OnWorkerEvent('failed')
  handleFailed(job: Job<PlanCompletionJobData> | undefined, error: Error): void {
    this.logger.error(`Plan completion job ${job?.id ?? 'unknown'} failed: ${error.message}`, error.stack);
  }
}
