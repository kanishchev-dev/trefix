import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { COACH_PROACTIVE_JOB, COACH_PROACTIVE_QUEUE, type ProactiveMessage } from './coach-proactive.constants';
import { CoachProactiveService } from './coach-proactive.service';

/** Delivers messages postponed by quiet hours; re-checks the settings at delivery time. */
@Processor(COACH_PROACTIVE_QUEUE)
export class CoachProactiveProcessor extends WorkerHost {
  private readonly logger = new Logger(CoachProactiveProcessor.name);

  constructor(private readonly proactiveService: CoachProactiveService) {
    super();
  }

  async process(job: Job<ProactiveMessage>): Promise<void> {
    if (job.name === COACH_PROACTIVE_JOB) {
      await this.proactiveService.deliver(job.data);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Proactive message ${job.id} failed: ${error.message}`, error.stack);
  }
}
