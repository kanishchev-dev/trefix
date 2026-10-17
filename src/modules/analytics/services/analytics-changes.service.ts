import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import { RedisService } from '@/common/redis/redis.service';

import {
  ANALYTICS_EVENTS,
  ANALYTICS_REALTIME_JOB,
  ANALYTICS_REALTIME_JOB_ID,
  ANALYTICS_REALTIME_QUEUE,
  ANALYTICS_REALTIME_THROTTLE_MS,
  ANALYTICS_VERSION_KEY,
} from '../analytics.constants';
import { AnalyticsDataChangedEvent } from '../events/analytics-data-changed.event';

/**
 * Tracks that the data behind the dashboard changed and lets open dashboards
 * know — throttled, because a block is an aggregate over the whole base and an
 * import of many activities must not trigger a recomputation per activity.
 *
 * The first change schedules one delayed flush job; changes until it runs are
 * folded into it (the job id is fixed). The flush bumps the data version, which
 * is part of every cache key, so the next request recomputes instead of
 * serving the cache, and announces the change to the admin panel.
 */
@Injectable()
export class AnalyticsChangesService {
  private readonly logger = new Logger(AnalyticsChangesService.name);

  constructor(
    @InjectQueue(ANALYTICS_REALTIME_QUEUE) private readonly queue: Queue,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Never throws: the action that changed the data must not fail because of analytics. */
  markChanged(): void {
    this.queue
      .add(
        ANALYTICS_REALTIME_JOB,
        {},
        {
          jobId: ANALYTICS_REALTIME_JOB_ID,
          delay: ANALYTICS_REALTIME_THROTTLE_MS,
          removeOnComplete: true,
          removeOnFail: true,
        },
      )
      .catch((error: Error) => {
        this.logger.warn(`Cannot schedule an analytics refresh: ${error.message}`);
      });
  }

  /** Current data version; 0 while nothing changed or Redis is unavailable. */
  async version(): Promise<number> {
    const redis = this.redisService.getOrNil();
    if (!redis) return 0;
    try {
      return Number(await redis.get(ANALYTICS_VERSION_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  /** Job body: a new version makes cached blocks stale, then the dashboards are told. */
  async flush(now = new Date()): Promise<number> {
    const redis = this.redisService.getOrThrow();
    const version = await redis.incr(ANALYTICS_VERSION_KEY);
    this.eventEmitter.emit(ANALYTICS_EVENTS.DATA_CHANGED, new AnalyticsDataChangedEvent(version, now.toISOString()));
    return version;
  }
}
