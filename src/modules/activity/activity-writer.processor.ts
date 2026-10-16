import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ACTIVITY_ERASE_JOB, ACTIVITY_WRITE_JOB, ACTIVITY_WRITE_QUEUE } from './activity.constants';
import type { ActivityEraseJobData } from './activity.listener';
import { ActivityService } from './activity.service';
import type { ActivityWriteJobData } from './activity-record.builder';

@Processor(ACTIVITY_WRITE_QUEUE)
export class ActivityWriterProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityWriterProcessor.name);

  constructor(private readonly activityService: ActivityService) {
    super();
  }

  async process(job: Job<ActivityWriteJobData | ActivityEraseJobData>): Promise<void> {
    if (job.name === ACTIVITY_WRITE_JOB) {
      await this.activityService.write(job.data as ActivityWriteJobData);
      return;
    }
    if (job.name === ACTIVITY_ERASE_JOB) {
      await this.activityService.eraseSubject((job.data as ActivityEraseJobData).userId);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    const data = job?.data as Partial<ActivityWriteJobData> | undefined;
    this.logger.error(
      `Activity job ${job?.name ?? 'unknown'} ${job?.id ?? ''} failed (action ${data?.action ?? '-'}, trace ${data?.traceId ?? '-'}): ${error.message}`,
      error.stack,
    );
  }
}
