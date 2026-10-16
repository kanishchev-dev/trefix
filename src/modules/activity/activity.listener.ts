import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import { getActivityContext } from '@/common/context/activity-context';
import type { AccountDeletionRequestedEvent } from '@/modules/users/account-deletion/account-deletion-requested.event';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { ACTIVITY_ERASE_JOB, ACTIVITY_WRITE_JOB, ACTIVITY_WRITE_QUEUE } from './activity.constants';
import { ACTIVITY_EVENT_REGISTRY, ACTIVITY_IGNORED_EVENTS } from './activity-event.registry';
import { type ActivityWriteJobData, buildActivityRecord } from './activity-record.builder';

export interface ActivityEraseJobData {
  userId: string;
}

/**
 * Captures every domain event into the activity history.
 *
 * Runs synchronously inside the emitting call so the actor can still be read
 * from the request context; the write itself goes through a queue.
 */
@Injectable()
export class ActivityListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActivityListener.name);
  private readonly reportedUnknown = new Set<string>();
  private readonly handler = (event: string | string[], payload: unknown): void => {
    this.capture(Array.isArray(event) ? event.join('.') : event, payload);
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(ACTIVITY_WRITE_QUEUE)
    private readonly queue: Queue<ActivityWriteJobData | ActivityEraseJobData>,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.onAny(this.handler);
  }

  onModuleDestroy(): void {
    this.eventEmitter.offAny(this.handler);
  }

  /** The history of a purged account goes with the account. */
  @OnEvent(USERS_EVENTS.ACCOUNT_PURGED, { async: true })
  async handleAccountPurged(event: AccountDeletionRequestedEvent): Promise<void> {
    await this.queue.add(ACTIVITY_ERASE_JOB, { userId: event.userId });
  }

  capture(action: string, payload: unknown): void {
    const descriptor = ACTIVITY_EVENT_REGISTRY[action];
    if (!descriptor) {
      if (!ACTIVITY_IGNORED_EVENTS.has(action) && !this.reportedUnknown.has(action)) {
        this.reportedUnknown.add(action);
        this.logger.warn(`Domain event "${action}" is not described for the activity history`);
      }
      return;
    }

    let record: ActivityWriteJobData;
    try {
      record = buildActivityRecord(action, payload, descriptor, getActivityContext(), new Date());
    } catch (error) {
      // History must never break the action that produced the event.
      this.logger.error(`Cannot describe "${action}" for the activity history: ${(error as Error).message}`);
      return;
    }

    this.queue.add(ACTIVITY_WRITE_JOB, record).catch((error: Error) => {
      this.logger.error(`Cannot queue activity "${action}" (trace ${record.traceId}): ${error.message}`, error.stack);
    });
  }
}
