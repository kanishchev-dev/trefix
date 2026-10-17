import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { TrainingModule } from '@/modules/training/training.module';

import analyticsConfig from './analytics.config';
import {
  ANALYTICS_ACTIVITY_QUEUE,
  ANALYTICS_LLM_USAGE_QUEUE,
  ANALYTICS_REALTIME_QUEUE,
  ANALYTICS_RECORDS_QUEUE,
  ANALYTICS_SNAPSHOT_QUEUE,
} from './analytics.constants';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsListener } from './analytics.listener';
import {
  AnalyticsActivityProcessor,
  AnalyticsLlmUsageProcessor,
  AnalyticsRealtimeProcessor,
  AnalyticsRecordsProcessor,
  AnalyticsSnapshotProcessor,
} from './analytics.processors';
import { AnalyticsActivityInterceptor } from './analytics-activity.interceptor';
import { AnalyticsRealtimeListener } from './analytics-realtime.listener';
import { AnalyticsSnapshotScheduler } from './analytics-snapshot.scheduler';
import { AnalyticsDailyMetric } from './entities/analytics-daily-metric.entity';
import { AthleteRecordLog } from './entities/athlete-record-log.entity';
import { GoalProgressSnapshot } from './entities/goal-progress-snapshot.entity';
import { LlmUsage } from './entities/llm-usage.entity';
import { UserDailyActivity } from './entities/user-daily-activity.entity';
import { ActivitySeriesService } from './services/activity-series.service';
import { ActivityTrackingService } from './services/activity-tracking.service';
import { AnalyticsCacheService } from './services/analytics-cache.service';
import { AnalyticsChangesService } from './services/analytics-changes.service';
import { AnalyticsDbService } from './services/analytics-db.service';
import { AttentionService } from './services/attention.service';
import { AudienceService } from './services/audience.service';
import { CoachAnalyticsService } from './services/coach-analytics.service';
import { EngagementService } from './services/engagement.service';
import { LlmUsageService } from './services/llm-usage.service';
import { OutcomeMetricsService } from './services/outcome-metrics.service';
import { OutcomesService } from './services/outcomes.service';
import { PlansAnalyticsService } from './services/plans-analytics.service';
import { RecordsLogService } from './services/records-log.service';
import { SnapshotService } from './services/snapshot.service';
import { SummaryService } from './services/summary.service';

const DEFAULT_OPTIONS = { defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS };
const RETRIED_OPTIONS = {
  defaultJobOptions: { ...DEFAULT_QUEUE_JOB_OPTIONS, attempts: 5, removeOnComplete: true },
};

/**
 * Product analytics of the admin dashboard: collects daily activity, LLM
 * usage and the records log, snapshots goal progress nightly and serves the
 * dashboard blocks. Read-only towards the domain tables.
 */
@Module({
  imports: [
    ConfigModule.forFeature(analyticsConfig),
    SequelizeModule.forFeature([
      UserDailyActivity,
      LlmUsage,
      AthleteRecordLog,
      GoalProgressSnapshot,
      AnalyticsDailyMetric,
    ]),
    BullModule.registerQueue(
      { name: ANALYTICS_ACTIVITY_QUEUE, ...RETRIED_OPTIONS },
      { name: ANALYTICS_LLM_USAGE_QUEUE, ...RETRIED_OPTIONS },
      {
        name: ANALYTICS_RECORDS_QUEUE,
        defaultJobOptions: { ...DEFAULT_QUEUE_JOB_OPTIONS, backoff: { type: 'exponential', delay: 10_000 } },
      },
      // A flush only bumps a counter; a lost one is replaced by the next change.
      { name: ANALYTICS_REALTIME_QUEUE, defaultJobOptions: { ...DEFAULT_QUEUE_JOB_OPTIONS, attempts: 2 } },
      {
        name: ANALYTICS_SNAPSHOT_QUEUE,
        defaultJobOptions: { ...DEFAULT_OPTIONS.defaultJobOptions, backoff: { type: 'exponential', delay: 60_000 } },
      },
    ),
    TrainingModule,
    RealtimeModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsDbService,
    AnalyticsCacheService,
    AnalyticsChangesService,
    SummaryService,
    ActivitySeriesService,
    EngagementService,
    OutcomeMetricsService,
    OutcomesService,
    PlansAnalyticsService,
    CoachAnalyticsService,
    AudienceService,
    AttentionService,
    ActivityTrackingService,
    LlmUsageService,
    RecordsLogService,
    SnapshotService,
    AnalyticsListener,
    AnalyticsRealtimeListener,
    AnalyticsActivityProcessor,
    AnalyticsLlmUsageProcessor,
    AnalyticsRecordsProcessor,
    AnalyticsSnapshotProcessor,
    AnalyticsRealtimeProcessor,
    AnalyticsSnapshotScheduler,
    { provide: APP_INTERCEPTOR, useClass: AnalyticsActivityInterceptor },
  ],
  exports: [SnapshotService, RecordsLogService],
})
export class AnalyticsModule {}
