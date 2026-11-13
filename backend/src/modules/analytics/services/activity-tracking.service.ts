import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { RedisService } from '@/common/redis/redis.service';
import { toLocalDateKey } from '@/modules/training/admin-calendar-day.util';

import {
  ANALYTICS_ACTIVITY_JOB,
  ANALYTICS_ACTIVITY_QUEUE,
  ANALYTICS_DEFAULT_TIMEZONE,
  ANALYTICS_SEEN_TTL_SECONDS,
  type AnalyticsPlatform,
} from '../analytics.constants';

export interface ActivitySeenJobData {
  userId: string;
  /** Local day in the analytics timezone. */
  date: string;
  platform: AnalyticsPlatform;
  appVersion: string | null;
  seenAt: string;
}

/**
 * Daily activity of users: the first authenticated request of a user from a
 * platform on a day writes one row; later requests only hit Redis.
 */
@Injectable()
export class ActivityTrackingService {
  private readonly logger = new Logger(ActivityTrackingService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @InjectQueue(ANALYTICS_ACTIVITY_QUEUE) private readonly queue: Queue<ActivitySeenJobData>,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  /** Never throws: tracking must not affect the request that triggered it. */
  async touch(userId: string, platform: AnalyticsPlatform, appVersion: string | null, now = new Date()): Promise<void> {
    const redis = this.redisService.getOrNil();
    if (!redis) return;
    const timezone = this.configService.get<string>('analytics.defaultTimezone') ?? ANALYTICS_DEFAULT_TIMEZONE;
    const date = toLocalDateKey(now, timezone);
    try {
      const first = await redis.set(
        `analytics:seen:${date}:${userId}:${platform}`,
        '1',
        'EX',
        ANALYTICS_SEEN_TTL_SECONDS,
        'NX',
      );
      if (first !== 'OK') return;
      await this.queue.add(
        ANALYTICS_ACTIVITY_JOB,
        { userId, date, platform, appVersion, seenAt: now.toISOString() },
        { removeOnComplete: true },
      );
    } catch (error) {
      this.logger.warn(`Cannot track activity of user ${userId}: ${(error as Error).message}`);
    }
  }

  /**
   * Rebuilds activity days from the traces users left before tracking existed:
   * their own actions in the history, workouts, coach messages, recordings and
   * the sign-up day. Existing rows are merged, so it can run repeatedly.
   */
  async backfill(from: string): Promise<number> {
    const timezone = this.configService.get<string>('analytics.defaultTimezone') ?? ANALYTICS_DEFAULT_TIMEZONE;
    const [row] = await this.sequelize.query<{ days: string }>(
      `WITH traces AS (
         SELECT ae.subject_user_id AS user_id, ae.occurred_at AS at,
                CASE WHEN lower(ae.client->>'platform') IN ('ios', 'android') THEN lower(ae.client->>'platform')
                     WHEN ae.source = 'web' THEN 'web' END AS platform
           FROM activity_events ae
          WHERE ae.actor_type = 'user' AND ae.subject_user_id IS NOT NULL AND ae.occurred_at >= :from::date
         UNION ALL
         SELECT a.user_id, w.completed_at, NULL
           FROM workouts w JOIN athletes a ON a.id = w.athlete_id
          WHERE w.deleted_at IS NULL AND w.status = 'completed' AND w.completed_at >= :from::date
         UNION ALL
         SELECT s.user_id, m.created_at, NULL
           FROM coach_messages m JOIN coach_sessions s ON s.id = m.session_id
          WHERE m.role = 'user' AND m.created_at >= :from::date
         UNION ALL
         SELECT a.user_id, r.started_at, NULL
           FROM recorded_activities r JOIN athletes a ON a.id = r.athlete_id
          WHERE r.started_at >= :from::date
         UNION ALL
         SELECT u.id, u.created_at, NULL FROM users u WHERE u.created_at >= :from::date
       ),
       days AS (
         SELECT t.user_id, (t.at AT TIME ZONE :tz)::date AS date,
                COALESCE(array_agg(DISTINCT t.platform) FILTER (WHERE t.platform IS NOT NULL), '{}')::varchar[] AS platforms,
                MIN(t.at) AS first_seen_at, MAX(t.at) AS last_seen_at
           FROM traces t
           JOIN users u ON u.id = t.user_id
          GROUP BY 1, 2
       ),
       upserted AS (
         INSERT INTO user_daily_activity (user_id, date, platforms, app_version, first_seen_at, last_seen_at)
         SELECT user_id, date, platforms, NULL, first_seen_at, last_seen_at FROM days
         ON CONFLICT (user_id, date) DO UPDATE SET
           platforms = ARRAY(SELECT DISTINCT unnest(user_daily_activity.platforms || EXCLUDED.platforms)),
           first_seen_at = LEAST(user_daily_activity.first_seen_at, EXCLUDED.first_seen_at),
           last_seen_at = GREATEST(user_daily_activity.last_seen_at, EXCLUDED.last_seen_at)
         RETURNING 1
       )
       SELECT COUNT(*) AS days FROM upserted`,
      { replacements: { from, tz: timezone }, type: QueryTypes.SELECT },
    );
    return Number(row?.days ?? 0);
  }

  /** Idempotent upsert; a deleted user is skipped. */
  async record(job: ActivitySeenJobData): Promise<void> {
    await this.sequelize.query(
      `INSERT INTO user_daily_activity (user_id, date, platforms, app_version, first_seen_at, last_seen_at)
       SELECT :userId, :date, ARRAY[:platform]::varchar[], :appVersion, :seenAt, :seenAt
        WHERE EXISTS (SELECT 1 FROM users WHERE id = :userId)
       ON CONFLICT (user_id, date) DO UPDATE SET
         platforms = ARRAY(SELECT DISTINCT unnest(user_daily_activity.platforms || EXCLUDED.platforms)),
         app_version = COALESCE(EXCLUDED.app_version, user_daily_activity.app_version),
         first_seen_at = LEAST(user_daily_activity.first_seen_at, EXCLUDED.first_seen_at),
         last_seen_at = GREATEST(user_daily_activity.last_seen_at, EXCLUDED.last_seen_at)`,
      { replacements: { ...job } },
    );
  }
}
