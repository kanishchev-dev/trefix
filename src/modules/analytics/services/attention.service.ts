import { Injectable } from '@nestjs/common';

import { OAUTH_PROVIDERS } from '@/modules/integrations/constants/integrations.constants';

import {
  ATTENTION_TYPES,
  type AttentionSeverity,
  type AttentionSort,
  type AttentionType,
  CHURN_RISK_DAYS,
  CHURN_RISK_HIGH_DAYS,
  EXPORT_PENDING_HOURS,
  GOAL_AT_RISK_ATTENTION_DAYS,
  NOTIFICATION_FAILURES_THRESHOLD,
  OVERLOAD_RATIO,
  SYNC_STALE_HOURS,
} from '../analytics.constants';
import type { AnalyticsAttentionItemDto, AnalyticsAttentionResponseDto } from '../dto/analytics-response.dto';
import type { AnalyticsScope } from '../lib/analytics-period';
import { COMPLETED_WORKOUT, ELIGIBLE_CTE, toNumber } from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';

/**
 * Every problem as (user_id, type, severity, since, details). The union is
 * filtered, counted and paged by the outer queries.
 */
const ITEMS = `
  SELECT e.user_id, 'churn_risk' AS type,
         CASE WHEN s.since <= now() - make_interval(days => :churnHighDays) THEN 'high' ELSE 'medium' END AS severity,
         s.since,
         jsonb_build_object(
           'daysWithoutWorkout', floor(EXTRACT(EPOCH FROM now() - s.since) / 86400)::int,
           'planId', p.id, 'planName', p.name) AS details
    FROM training_plans p
    JOIN eligible e ON e.athlete_id = p.athlete_id
    JOIN users u ON u.id = e.user_id
    LEFT JOIN LATERAL (
      SELECT MAX(w.completed_at) AS at FROM workouts w WHERE w.athlete_id = p.athlete_id AND ${COMPLETED_WORKOUT}
    ) last_run ON true
    CROSS JOIN LATERAL (SELECT GREATEST(last_run.at, p.start_date::timestamptz) AS since) s
   WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.start_date IS NOT NULL
     AND u.blocked_at IS NULL
     AND s.since <= now() - make_interval(days => :churnDays)

  UNION ALL
  SELECT e.user_id, 'overload_risk', 'high', st.since,
         jsonb_build_object('ratio', round(st.ratio::numeric, 2))
    FROM (
      SELECT s.athlete_id, MIN(s.created_at) AS since,
             (array_agg(s.acute_load / NULLIF(s.chronic_load, 0) ORDER BY s.created_at DESC))[1] AS ratio
        FROM athlete_states s
       WHERE s.created_at >= now() - interval '7 days'
       GROUP BY s.athlete_id
      HAVING bool_and(s.chronic_load > 0 AND s.acute_load / s.chronic_load > :overloadRatio)
         AND MIN(s.created_at) <= now() - interval '5 days'
         AND MAX(s.created_at) >= now() - interval '3 days'
    ) st
    JOIN eligible e ON e.athlete_id = st.athlete_id

  UNION ALL
  SELECT e.user_id, 'goal_at_risk', 'medium', at_risk.since::timestamptz,
         jsonb_build_object('goalId', last.goal_id, 'goalType', last.goal_type,
                            'targetDate', last.target_date, 'progressPct', last.progress_pct)
    FROM (
      SELECT DISTINCT ON (s.goal_id) s.goal_id, s.athlete_id, s.goal_type, s.status, s.target_date, s.progress_pct
        FROM goal_progress_snapshots s
       WHERE s.date >= :today::date - 3
       ORDER BY s.goal_id, s.date DESC
    ) last
    JOIN LATERAL (
      SELECT MIN(s.date) AS since FROM goal_progress_snapshots s
       WHERE s.goal_id = last.goal_id AND s.status = 'at_risk' AND s.date >= :today::date - 30
    ) at_risk ON true
    JOIN athlete_goals g ON g.id = last.goal_id AND g.deleted_at IS NULL AND g.status = 'active'
    JOIN eligible e ON e.athlete_id = last.athlete_id
   WHERE last.status = 'at_risk'
     AND last.target_date BETWEEN :today::date AND :today::date + :goalDays

  UNION ALL
  SELECT e.user_id, 'integration_error', 'medium', COALESCE(i.last_sync_at, i.updated_at),
         jsonb_build_object('provider', i.provider, 'status', i.status)
    FROM integrations i
    JOIN eligible e ON e.athlete_id = i.athlete_id
   WHERE i.deleted_at IS NULL AND i.status IN ('error', 'reauthorization_required')

  UNION ALL
  SELECT e.user_id, 'sync_stale', 'low', i.last_successful_sync_at,
         jsonb_build_object('provider', i.provider,
                            'hoursSinceSync', floor(EXTRACT(EPOCH FROM now() - i.last_successful_sync_at) / 3600)::int)
    FROM integrations i
    JOIN eligible e ON e.athlete_id = i.athlete_id
   WHERE i.deleted_at IS NULL AND i.status = 'connected' AND i.provider IN (:oauthProviders)
     AND i.last_successful_sync_at < now() - make_interval(hours => :staleHours)

  UNION ALL
  SELECT e.user_id, 'notification_failed', 'low', f.since,
         jsonb_build_object('failures', f.failures, 'channels', f.channels)
    FROM (
      SELECT n.user_id, MIN(d.created_at) AS since, COUNT(*)::int AS failures,
             array_agg(DISTINCT d.channel) AS channels
        FROM notification_deliveries d
        JOIN notifications n ON n.id = d.notification_id
       WHERE d.status = 'failed' AND d.created_at >= now() - interval '7 days'
       GROUP BY n.user_id
      HAVING COUNT(*) >= :failures
    ) f
    JOIN eligible e ON e.user_id = f.user_id

  UNION ALL
  SELECT e.user_id, 'export_pending', 'medium', x.created_at, jsonb_build_object('exportId', x.id)
    FROM data_exports x
    JOIN eligible e ON e.user_id = x.user_id
   WHERE x.status = 'pending' AND x.created_at < now() - make_interval(hours => :exportHours)

  UNION ALL
  SELECT e.user_id, 'export_failed', 'medium', x.updated_at, jsonb_build_object('exportId', x.id)
    FROM data_exports x
    JOIN eligible e ON e.user_id = x.user_id
   WHERE x.status = 'failed' AND x.updated_at >= now() - interval '7 days'
`;

const SEVERITY_RANK = `CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`;

/** Users that need an administrator: likely to leave, overloaded, or with something broken. */
@Injectable()
export class AttentionService {
  constructor(private readonly db: AnalyticsDbService) {}

  async items(
    scope: AnalyticsScope,
    filter: { types?: AttentionType[]; page: number; limit: number; sortBy: AttentionSort },
  ): Promise<Omit<AnalyticsAttentionResponseDto, 'generatedAt'>> {
    const types = filter.types?.length ? filter.types : [...ATTENTION_TYPES];
    const replacements = {
      churnDays: CHURN_RISK_DAYS,
      churnHighDays: CHURN_RISK_HIGH_DAYS,
      overloadRatio: OVERLOAD_RATIO,
      goalDays: GOAL_AT_RISK_ATTENTION_DAYS,
      oauthProviders: [...OAUTH_PROVIDERS],
      staleHours: SYNC_STALE_HOURS,
      failures: NOTIFICATION_FAILURES_THRESHOLD,
      exportHours: EXPORT_PENDING_HOURS,
      types,
      limit: filter.limit,
      offset: (filter.page - 1) * filter.limit,
    };
    const order =
      filter.sortBy === 'since' ? 'items.since ASC NULLS LAST' : `${SEVERITY_RANK}, items.since ASC NULLS LAST`;
    const [counts, rows] = await Promise.all([
      this.db.select<{ type: AttentionType; items: string }>(
        `WITH ${ELIGIBLE_CTE}, items AS (${ITEMS})
         SELECT type, COUNT(*) AS items FROM items GROUP BY type`,
        scope,
        replacements,
      ),
      this.db.select<{
        user_id: string;
        type: AttentionType;
        severity: AttentionSeverity;
        since: Date | null;
        details: Record<string, unknown>;
        first_name: string;
        last_name: string;
        email: string;
        avatar_url: string | null;
      }>(
        `WITH ${ELIGIBLE_CTE}, items AS (${ITEMS})
         SELECT items.*, u.first_name, u.last_name, u.email, u.avatar_url
           FROM items
           JOIN users u ON u.id = items.user_id
          WHERE items.type IN (:types)
          ORDER BY ${order}, items.user_id
          LIMIT :limit OFFSET :offset`,
        scope,
        replacements,
      ),
    ]);
    const countByType = new Map(counts.map((row) => [row.type, toNumber(row.items)]));
    const total = types.reduce((sum, type) => sum + (countByType.get(type) ?? 0), 0);
    const data: AnalyticsAttentionItemDto[] = rows.map((row) => ({
      type: row.type,
      severity: row.severity,
      since: row.since ? new Date(row.since).toISOString() : null,
      user: {
        id: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        avatarUrl: row.avatar_url,
      },
      details: row.details ?? {},
    }));
    return {
      counts: ATTENTION_TYPES.map((type) => ({ type, count: countByType.get(type) ?? 0 })),
      data,
      meta: {
        total,
        page: filter.page,
        limit: filter.limit,
        totalPages: Math.ceil(total / filter.limit),
        hasNextPage: filter.page * filter.limit < total,
        hasPreviousPage: filter.page > 1,
      },
    };
  }
}
