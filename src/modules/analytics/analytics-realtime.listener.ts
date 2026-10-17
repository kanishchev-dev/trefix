import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { COACH_EVENTS } from '@/modules/coach/coach.events';
import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { OPENAI_EVENTS } from '@/modules/openai/openai.events';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { TRAINING_EVENTS } from '@/modules/training/training.events';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { ANALYTICS_EVENTS } from './analytics.constants';
import { AnalyticsDataChangedEvent } from './events/analytics-data-changed.event';
import { AnalyticsChangesService } from './services/analytics-changes.service';

/**
 * Live dashboard: domain events that move a metric mark the analytics data as
 * changed, and each (throttled) change is pushed to the `analytics` room.
 */
@Injectable()
export class AnalyticsRealtimeListener {
  constructor(
    private readonly changes: AnalyticsChangesService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @OnEvent(TRAINING_EVENTS.WORKOUT_COMPLETED)
  @OnEvent(TRAINING_EVENTS.WORKOUT_CREATED)
  @OnEvent(TRAINING_EVENTS.WORKOUT_UPDATED)
  @OnEvent(TRAINING_EVENTS.WORKOUT_DELETED)
  @OnEvent(TRAINING_EVENTS.PLAN_CREATED)
  @OnEvent(TRAINING_EVENTS.PLAN_STARTED)
  @OnEvent(TRAINING_EVENTS.PLAN_COMPLETED)
  @OnEvent(TRAINING_EVENTS.PLAN_CANCELLED)
  @OnEvent(TRAINING_EVENTS.PLAN_DELETED)
  @OnEvent(TRAINING_EVENTS.PLAN_ADAPTATION_PROPOSED)
  @OnEvent(TRAINING_EVENTS.PLAN_ADAPTED)
  @OnEvent(TRAINING_EVENTS.PLAN_ADAPTATION_DISMISSED)
  @OnEvent(TRAINING_EVENTS.GOAL_CREATED)
  @OnEvent(TRAINING_EVENTS.STATE_UPDATED)
  @OnEvent(TRAINING_EVENTS.PROGRESS_UPDATED)
  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_IMPORTED)
  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_MERGED)
  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_UPDATED)
  @OnEvent(INTEGRATIONS_EVENTS.CONNECTED)
  @OnEvent(INTEGRATIONS_EVENTS.DISCONNECTED)
  @OnEvent(COACH_EVENTS.REPLY_GENERATED)
  @OnEvent(COACH_EVENTS.PROACTIVE_MESSAGE_SENT)
  @OnEvent(COACH_EVENTS.WORKOUT_NOTE_GENERATED)
  @OnEvent(OPENAI_EVENTS.USAGE_RECORDED)
  @OnEvent(AUTH_EVENTS.REGISTERED)
  @OnEvent(USERS_EVENTS.USER_BLOCKED)
  @OnEvent(USERS_EVENTS.USER_UNBLOCKED)
  @OnEvent(USERS_EVENTS.ACCOUNT_DELETION_REQUESTED)
  @OnEvent(USERS_EVENTS.DATA_EXPORT_REQUESTED)
  @OnEvent(USERS_EVENTS.DATA_EXPORT_READY)
  onDataChanged(): void {
    this.changes.markChanged();
  }

  @OnEvent(ANALYTICS_EVENTS.DATA_CHANGED)
  onAnalyticsChanged(event: AnalyticsDataChangedEvent): void {
    this.realtimeService.emitToRoom('analytics', 'analytics.updated', event);
  }
}
