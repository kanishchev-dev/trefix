import { Injectable } from '@nestjs/common';

import { HABIT_WEEKS } from '../analytics.constants';
import type { AnalyticsAudienceResponseDto } from '../dto/analytics-response.dto';
import { type AnalyticsScope, dateRange, share } from '../lib/analytics-period';
import { COMPLETED_WORKOUT, ELIGIBLE_CTE, localDay, toDateKey, toNumber } from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';

const CONNECTED = `('connected', 'syncing')`;
const BROKEN = `('error', 'reauthorization_required')`;

/** Who the users are: sign-ups, activation, platforms, connected services. */
@Injectable()
export class AudienceService {
  constructor(private readonly db: AnalyticsDbService) {}

  async audience(scope: AnalyticsScope): Promise<Omit<AnalyticsAudienceResponseDto, 'generatedAt'>> {
    const [totals, registrations, activationFunnel, platforms, integrations, experience, languages] = await Promise.all(
      [
        this.totals(scope),
        this.registrations(scope),
        this.activationFunnel(scope),
        this.platforms(scope),
        this.integrations(scope),
        this.experience(scope),
        this.languages(scope),
      ],
    );
    return { totals, ...registrations, activationFunnel, ...platforms, ...integrations, experience, languages };
  }

  private async totals(scope: AnalyticsScope): Promise<AnalyticsAudienceResponseDto['totals']> {
    const row = await this.db.one<{ users: string; blocked: string; new_users: string; deleted: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(*) AS users,
              COUNT(*) FILTER (WHERE u.blocked_at IS NOT NULL AND (u.blocked_until IS NULL OR u.blocked_until > now())) AS blocked,
              COUNT(*) FILTER (WHERE ${localDay('e.registered_at')} BETWEEN :from AND :to) AS new_users,
              (SELECT COUNT(DISTINCT ae.subject_user_id)
                 FROM activity_events ae
                WHERE ae.action = 'account.deletion_requested'
                  AND ${localDay('ae.occurred_at')} BETWEEN :from AND :to) AS deleted
         FROM eligible e
         JOIN users u ON u.id = e.user_id`,
      scope,
    );
    return {
      users: toNumber(row.users),
      blocked: toNumber(row.blocked),
      newInPeriod: toNumber(row.new_users),
      deletedInPeriod: toNumber(row.deleted),
    };
  }

  private async registrations(
    scope: AnalyticsScope,
  ): Promise<Pick<AnalyticsAudienceResponseDto, 'registrations' | 'registrationsByProvider'>> {
    const registered = localDay('e.registered_at');
    const [daily, providers] = await Promise.all([
      this.db.select<{ day: unknown; users: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT ${registered} AS day, COUNT(*) AS users FROM eligible e WHERE ${registered} BETWEEN :from AND :to GROUP BY 1`,
        scope,
      ),
      this.db.select<{ provider: string; users: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT COALESCE(
                  (SELECT i.provider FROM user_identities i WHERE i.user_id = e.user_id ORDER BY i.created_at LIMIT 1),
                  'email') AS provider,
                COUNT(*) AS users
           FROM eligible e
          WHERE ${registered} BETWEEN :from AND :to
          GROUP BY 1
          ORDER BY 2 DESC`,
        scope,
      ),
    ]);
    const byDay = new Map(daily.map((row) => [toDateKey(row.day), toNumber(row.users)]));
    return {
      registrations: dateRange(scope.from, scope.to).map((date) => ({ date, users: byDay.get(date) ?? 0 })),
      registrationsByProvider: providers.map((row) => ({ provider: row.provider, users: toNumber(row.users) })),
    };
  }

  /** Users registered in the period, step by step to a running habit. */
  private async activationFunnel(scope: AnalyticsScope): Promise<AnalyticsAudienceResponseDto['activationFunnel']> {
    const row = await this.db.one<Record<string, string>>(
      `WITH ${ELIGIBLE_CTE},
       cohort AS (
         SELECT e.user_id, e.athlete_id FROM eligible e WHERE ${localDay('e.registered_at')} BETWEEN :from AND :to
       ),
       firsts AS (
         SELECT w.athlete_id, MIN(${localDay('w.completed_at')}) AS first_day
           FROM workouts w
           JOIN cohort c ON c.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT}
          GROUP BY w.athlete_id
       ),
       habits AS (
         SELECT f.athlete_id
           FROM firsts f
           JOIN workouts w ON w.athlete_id = f.athlete_id
          WHERE ${COMPLETED_WORKOUT}
            AND ${localDay('w.completed_at')} BETWEEN f.first_day AND f.first_day + 27
          GROUP BY f.athlete_id
         HAVING COUNT(DISTINCT (${localDay('w.completed_at')} - f.first_day) / 7) >= :habitWeeks
       )
       SELECT COUNT(*) AS registered,
              COUNT(*) FILTER (WHERE u.email_verified) AS email_verified,
              COUNT(c.athlete_id) AS athlete_profile,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM athlete_goals g WHERE g.athlete_id = c.athlete_id AND g.deleted_at IS NULL)) AS goal_set,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM training_plans p
                 WHERE p.athlete_id = c.athlete_id AND p.deleted_at IS NULL AND p.status <> 'draft')) AS plan_created,
              COUNT(*) FILTER (WHERE c.athlete_id IN (SELECT athlete_id FROM firsts)) AS first_workout,
              COUNT(*) FILTER (WHERE c.athlete_id IN (SELECT athlete_id FROM habits)) AS habit
         FROM cohort c
         JOIN users u ON u.id = c.user_id`,
      scope,
      { habitWeeks: HABIT_WEEKS },
    );
    return [
      'registered',
      'email_verified',
      'athlete_profile',
      'goal_set',
      'plan_created',
      'first_workout',
      'habit',
    ].map((step) => ({ step, count: toNumber(row[step]) }));
  }

  /** Platforms of users active in the last 28 days and app versions of their devices. */
  private async platforms(scope: AnalyticsScope): Promise<Pick<AnalyticsAudienceResponseDto, 'platforms' | 'appVersions'>> {
    const [platforms, versions] = await Promise.all([
      this.db.select<{ platform: string; users: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT platform, COUNT(DISTINCT a.user_id) AS users
           FROM user_daily_activity a, unnest(a.platforms) AS platform
          WHERE a.date BETWEEN (:today::date - 27) AND :today AND a.user_id IN (SELECT user_id FROM eligible)
          GROUP BY 1
          ORDER BY 2 DESC`,
        scope,
      ),
      this.db.select<{ platform: string; app_version: string | null; users: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT d.platform, d.app_version, COUNT(DISTINCT d.user_id) AS users
           FROM push_devices d
           JOIN eligible e ON e.user_id = d.user_id
          WHERE d.last_seen_at >= (:today::date - 27)
          GROUP BY 1, 2
          ORDER BY 3 DESC`,
        scope,
      ),
    ]);
    return {
      platforms: platforms.map((row) => ({ platform: row.platform, users: toNumber(row.users) })),
      appVersions: versions.map((row) => ({
        platform: row.platform,
        appVersion: row.app_version,
        users: toNumber(row.users),
      })),
    };
  }

  private async integrations(
    scope: AnalyticsScope,
  ): Promise<Pick<AnalyticsAudienceResponseDto, 'integrations' | 'usersWithIntegrationShare'>> {
    const [rows, totals] = await Promise.all([
      this.db.select<{ provider: string; connected: string; errors: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT i.provider,
                COUNT(*) FILTER (WHERE i.status IN ${CONNECTED}) AS connected,
                COUNT(*) FILTER (WHERE i.status IN ${BROKEN}) AS errors
           FROM integrations i
           JOIN eligible e ON e.athlete_id = i.athlete_id
          WHERE i.deleted_at IS NULL
          GROUP BY 1
          ORDER BY 2 DESC`,
        scope,
      ),
      this.db.one<{ users: string; connected: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT COUNT(*) AS users,
                COUNT(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM integrations i
                   WHERE i.athlete_id = e.athlete_id AND i.deleted_at IS NULL AND i.status IN ${CONNECTED})) AS connected
           FROM eligible e`,
        scope,
      ),
    ]);
    return {
      integrations: rows.map((row) => ({
        provider: row.provider,
        connected: toNumber(row.connected),
        errors: toNumber(row.errors),
      })),
      usersWithIntegrationShare: share(toNumber(totals.connected), toNumber(totals.users)),
    };
  }

  private async experience(scope: AnalyticsScope): Promise<AnalyticsAudienceResponseDto['experience']> {
    const rows = await this.db.select<{ level: string; athletes: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT a.experience_level AS level, COUNT(*) AS athletes
         FROM athletes a
         JOIN eligible e ON e.athlete_id = a.id
        GROUP BY 1`,
      scope,
    );
    return rows.map((row) => ({ level: row.level, athletes: toNumber(row.athletes) }));
  }

  private async languages(scope: AnalyticsScope): Promise<AnalyticsAudienceResponseDto['languages']> {
    const rows = await this.db.select<{ language: string; users: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COALESCE(p.language, 'system') AS language, COUNT(*) AS users
         FROM eligible e
         LEFT JOIN user_preferences p ON p.user_id = e.user_id
        GROUP BY 1
        ORDER BY 2 DESC`,
      scope,
    );
    return rows.map((row) => ({ language: row.language, users: toNumber(row.users) }));
  }
}
