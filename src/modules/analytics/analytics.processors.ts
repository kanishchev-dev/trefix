import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  ANALYTICS_ACTIVITY_QUEUE,
  ANALYTICS_LLM_USAGE_QUEUE,
  ANALYTICS_REALTIME_QUEUE,
  ANALYTICS_RECORDS_QUEUE,
  ANALYTICS_SNAPSHOT_QUEUE,
} from './analytics.constants';
import { type ActivitySeenJobData, ActivityTrackingService } from './services/activity-tracking.service';
import { AnalyticsChangesService } from './services/analytics-changes.service';
import { type LlmUsageJobData, LlmUsageService } from './services/llm-usage.service';
import { type RecordsJobData, RecordsLogService } from './services/records-log.service';
import { SnapshotService } from './services/snapshot.service';

/* One processor per queue; each delegates to its service and is idempotent. */

@Processor(ANALYTICS_ACTIVITY_QUEUE)
export class AnalyticsActivityProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsActivityProcessor.name);

  constructor(
    private readonly trackingService: ActivityTrackingService,
    private readonly changes: AnalyticsChangesService,
  ) {
    super();
  }

  async process(job: Job<ActivitySeenJobData>): Promise<void> {
    await this.trackingService.record(job.data);
    this.changes.markChanged();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ActivitySeenJobData> | undefined, error: Error): void {
    this.logger.error(
      `Activity job ${job?.id ?? 'unknown'} (user ${job?.data.userId ?? '-'}) failed: ${error.message}`,
      error.stack,
    );
  }
}

@Processor(ANALYTICS_LLM_USAGE_QUEUE)
export class AnalyticsLlmUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsLlmUsageProcessor.name);

  constructor(private readonly usageService: LlmUsageService) {
    super();
  }

  async process(job: Job<LlmUsageJobData>): Promise<void> {
    await this.usageService.record(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<LlmUsageJobData> | undefined, error: Error): void {
    this.logger.error(
      `LLM usage job ${job?.id ?? 'unknown'} (${job?.data.feature ?? '-'}) failed: ${error.message}`,
      error.stack,
    );
  }
}

@Processor(ANALYTICS_RECORDS_QUEUE)
export class AnalyticsRecordsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsRecordsProcessor.name);

  constructor(
    private readonly recordsService: RecordsLogService,
    private readonly changes: AnalyticsChangesService,
  ) {
    super();
  }

  async process(job: Job<RecordsJobData>): Promise<{ inserted: number }> {
    const inserted = await this.recordsService.refresh(job.data);
    this.changes.markChanged();
    return { inserted };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RecordsJobData> | undefined, error: Error): void {
    this.logger.error(`Records job ${job?.id ?? 'unknown'} failed: ${error.message}`, error.stack);
  }
}

@Processor(ANALYTICS_SNAPSHOT_QUEUE)
export class AnalyticsSnapshotProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsSnapshotProcessor.name);

  constructor(
    private readonly snapshotService: SnapshotService,
    private readonly changes: AnalyticsChangesService,
  ) {
    super();
  }

  async process(): Promise<{ goals: number; days: number }> {
    const result = await this.snapshotService.runDaily();
    this.changes.markChanged();
    return result;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Analytics snapshot ${job?.id ?? 'unknown'} failed: ${error.message}`, error.stack);
  }
}

@Processor(ANALYTICS_REALTIME_QUEUE)
export class AnalyticsRealtimeProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsRealtimeProcessor.name);

  constructor(private readonly changes: AnalyticsChangesService) {
    super();
  }

  async process(): Promise<{ version: number }> {
    return { version: await this.changes.flush() };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Analytics realtime flush ${job?.id ?? 'unknown'} failed: ${error.message}`, error.stack);
  }
}
