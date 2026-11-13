import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  DATA_EXPORT_BUILD_JOB,
  DATA_EXPORT_EXPIRE_JOB,
  DATA_EXPORT_QUEUE,
  type DataExportJobData,
} from './data-export.constants';
import { DataExportService } from './data-export.service';

@Processor(DATA_EXPORT_QUEUE)
export class DataExportProcessor extends WorkerHost {
  private readonly logger = new Logger(DataExportProcessor.name);

  constructor(private readonly dataExportService: DataExportService) {
    super();
  }

  async process(job: Job<DataExportJobData>): Promise<void> {
    if (job.name === DATA_EXPORT_BUILD_JOB) {
      await this.dataExportService.build(job.data.exportId);
    } else if (job.name === DATA_EXPORT_EXPIRE_JOB) {
      await this.dataExportService.expire(job.data.exportId);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<DataExportJobData>, error: Error): Promise<void> {
    this.logger.error(`Data export job ${job.id} failed: ${error.message}`, error.stack);
    const attempts = job.opts.attempts ?? 1;
    if (job.name === DATA_EXPORT_BUILD_JOB && job.attemptsMade >= attempts) {
      await this.dataExportService.markFailed(job.data.exportId, error.message);
    }
  }
}
