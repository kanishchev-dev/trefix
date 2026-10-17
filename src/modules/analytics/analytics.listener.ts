import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import type { ActivityImportedEvent } from '@/modules/integrations/events/activity-imported.event';
import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { OPENAI_EVENTS, type OpenAiUsageRecordedEvent } from '@/modules/openai/openai.events';
import type { WorkoutCompletedEvent } from '@/modules/training/events/workout-completed.event';
import type { ProgressUpdatedEvent } from '@/modules/training/progress/progress.service';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import {
  ANALYTICS_LLM_USAGE_JOB,
  ANALYTICS_LLM_USAGE_QUEUE,
  ANALYTICS_RECORDS_DELAY_MS,
  ANALYTICS_RECORDS_JOB,
  ANALYTICS_RECORDS_QUEUE,
} from './analytics.constants';
import type { LlmUsageJobData } from './services/llm-usage.service';
import type { RecordsJobData } from './services/records-log.service';

/** Turns domain events into analytics jobs; never does I/O beyond enqueueing. */
@Injectable()
export class AnalyticsListener {
  private readonly logger = new Logger(AnalyticsListener.name);

  constructor(
    @InjectQueue(ANALYTICS_LLM_USAGE_QUEUE) private readonly llmQueue: Queue<LlmUsageJobData>,
    @InjectQueue(ANALYTICS_RECORDS_QUEUE) private readonly recordsQueue: Queue<RecordsJobData>,
  ) {}

  @OnEvent(OPENAI_EVENTS.USAGE_RECORDED)
  onLlmUsage(event: OpenAiUsageRecordedEvent): void {
    const data: LlmUsageJobData = {
      feature: event.feature,
      userId: event.userId,
      model: event.model,
      inputTokens: event.inputTokens,
      cachedInputTokens: event.cachedInputTokens,
      outputTokens: event.outputTokens,
      latencyMs: event.latencyMs,
      status: event.status,
      createdAt: new Date().toISOString(),
    };
    this.llmQueue.add(ANALYTICS_LLM_USAGE_JOB, data, { removeOnComplete: true }).catch((error: Error) => {
      this.logger.error(`Cannot queue LLM usage of ${event.feature}: ${error.message}`);
    });
  }

  @OnEvent(TRAINING_EVENTS.WORKOUT_COMPLETED)
  onWorkoutCompleted(event: WorkoutCompletedEvent): void {
    this.refreshRecords({ athleteId: event.athleteId });
  }

  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_IMPORTED)
  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_MERGED)
  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_UPDATED)
  onActivityImported(event: Pick<ActivityImportedEvent, 'athleteId'>): void {
    this.refreshRecords({ athleteId: event.athleteId });
  }

  /** Manual results and "exclude from records" changes. */
  @OnEvent(TRAINING_EVENTS.PROGRESS_UPDATED)
  onProgressUpdated(event: ProgressUpdatedEvent): void {
    this.refreshRecords({ userId: event.userId });
  }

  /** Bursts of events (an import of many activities) collapse into one delayed job per athlete. */
  private refreshRecords(data: RecordsJobData): void {
    const jobId = `records-${data.athleteId ?? `user-${data.userId}`}`;
    this.recordsQueue
      .add(ANALYTICS_RECORDS_JOB, data, { jobId, delay: ANALYTICS_RECORDS_DELAY_MS, removeOnComplete: true })
      .catch((error: Error) => {
        this.logger.error(`Cannot queue records refresh ${jobId}: ${error.message}`);
      });
  }
}
