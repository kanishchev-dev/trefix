import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ACCOUNT_DELETION_JOB, ACCOUNT_DELETION_QUEUE } from '../users.constants';
import { AccountDeletionService, AccountPurgeJobData } from './account-deletion.service';

@Processor(ACCOUNT_DELETION_QUEUE)
export class AccountDeletionProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountDeletionProcessor.name);

  constructor(private readonly accountDeletionService: AccountDeletionService) {
    super();
  }

  async process(job: Job<AccountPurgeJobData>): Promise<void> {
    if (job.name !== ACCOUNT_DELETION_JOB) {
      return;
    }
    await this.accountDeletionService.purge(job.data.userId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Account purge ${job.id} failed: ${error.message}`, error.stack);
  }
}
