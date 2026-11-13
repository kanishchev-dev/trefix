import { Injectable } from '@nestjs/common';

import { GOAL_TYPE_CATEGORY } from '@/modules/training/goal-taxonomy';

import { PLAN_PROGRESS_BUCKETS, PLAN_WEEKS_MAX } from '../analytics.constants';
import type { AnalyticsPlansResponseDto } from '../dto/analytics-response.dto';
import { type AnalyticsScope, share, weekRange } from '../lib/analytics-period';
import { ELIGIBLE_CTE, localDay, localWeek, toDateKey, toNumber, toNumberOrNull } from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';

/** Goal types whose target is a race on a distance. */
const RACE_GOAL_TYPES = Object.entries(GOAL_TYPE_CATEGORY)
  .filter(([, category]) => category === 'race_event')
  .map(([type]) => type);

/** Distance buckets of upcoming races, in metres. */
const RACE_DISTANCES: Array<{ key: string; meters: number }> = [
  { key: '5k', meters: 5000 },
  { key: '10k', meters: 10_000 },
  { key: 'half_marathon', meters: 21_097.5 },
  { key: 'marathon', meters: 42_195 },
];
const LEGACY_DISTANCE_M: Record<string, number> = Object.fromEntries(
  RACE_DISTANCES.map((entry) => [entry.key, entry.meters]),
);

/** How plans are created, followed and finished. */
@Injectable()
export class PlansAnalyticsService {
  constructor(private readonly db: AnalyticsDbService) {}

  async plans(scope: AnalyticsScope): Promise<Omit<AnalyticsPlansResponseDto, 'generatedAt'>> {
    const [active, created, finished, adherenceByPlanWeek, goalTypes, upcomingRaces, adaptations] = await Promise.all([
      this.activePlans(scope),
      this.created(scope),
      this.finished(scope),
      this.adherenceByPlanWeek(scope),
      this.goalTypes(scope),
      this.upcomingRaces(scope),
      this.adaptations(scope),
    ]);
    return { active, created, ...finished, adherenceByPlanWeek, goalTypes, upcomingRaces, adaptations };
  }

  private async activePlans(scope: AnalyticsScope): Promise<number> {
    const row = await this.db.one<{ plans: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(*) AS plans
         FROM training_plans p
         JOIN eligible e ON e.athlete_id = p.athlete_id
        WHERE p.deleted_at IS NULL AND p.status = 'active'`,
      scope,
    );
    return toNumber(row.plans);
  }

  private async created(scope: AnalyticsScope): Promise<AnalyticsPlansResponseDto['created']> {
    const rows = await this.db.select<{ week: unknown; source: string; plans: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT ${localWeek('p.created_at')} AS week,
              CASE WHEN p.source_plan_id IS NOT NULL THEN 'rebuild' ELSE p.creation_source END AS source,
              COUNT(*) AS plans
         FROM training_plans p
         JOIN eligible e ON e.athlete_id = p.athlete_id
        WHERE p.deleted_at IS NULL AND p.status <> 'draft' AND ${localDay('p.created_at')} BETWEEN :from AND :to
        GROUP BY 1, 2`,
      scope,
    );
    const count = (week: string, source: string): number =>
      rows
        .filter((row) => toDateKey(row.week) === week && row.source === source)
        .reduce((sum, row) => sum + toNumber(row.plans), 0);
    return weekRange(scope.from, scope.to).map((week) => ({
      week,
      ai: count(week, 'ai'),
      manual: count(week, 'manual'),
      rebuild: count(week, 'rebuild'),
    }));
  }

  /** Plans that ended in the period: completion, cancellation and how far they got. */
  private async finished(
    scope: AnalyticsScope,
  ): Promise<Pick<AnalyticsPlansResponseDto, 'outcomes' | 'cancellationByProgress' | 'cancelReasons'>> {
    const rows = await this.db.select<{ status: string; reason: string | null; progress: string | null }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT p.status, p.cancel_reason AS reason,
              CASE WHEN p.end_date > p.start_date
                   THEN (p.cancelled_at::date - p.start_date)::numeric / (p.end_date - p.start_date) END AS progress
         FROM training_plans p
         JOIN eligible e ON e.athlete_id = p.athlete_id
        WHERE p.deleted_at IS NULL
          AND ((p.status = 'completed' AND p.end_date BETWEEN :from AND :to)
            OR (p.status = 'cancelled' AND ${localDay('p.cancelled_at')} BETWEEN :from AND :to))`,
      scope,
    );
    const quit = rows.filter((row) => row.status === 'cancelled' && (row.reason === 'user' || row.reason === 'admin'));
    const buckets = new Map<string, number>();
    for (const row of quit) {
      const progress = toNumberOrNull(row.progress);
      if (progress === null) continue;
      const bucket = progress < 0.25 ? '0_25' : progress < 0.5 ? '25_50' : progress < 0.75 ? '50_75' : '75_100';
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    const reasons = new Map<string, number>();
    for (const row of rows.filter((entry) => entry.status === 'cancelled' && entry.reason !== 'migration')) {
      const reason = row.reason ?? 'user';
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    return {
      outcomes: {
        completed: rows.filter((row) => row.status === 'completed').length,
        cancelled: quit.length,
        replaced: rows.filter((row) => row.status === 'cancelled' && row.reason === 'replaced').length,
      },
      cancellationByProgress: PLAN_PROGRESS_BUCKETS.map((bucket) => ({ bucket, plans: buckets.get(bucket) ?? 0 })),
      cancelReasons: [...reasons.entries()]
        .map(([reason, plans]) => ({ reason, plans }))
        .sort((a, b) => b.plans - a.plans),
    };
  }

  /** Done / (done + missed) by the week number of the plan, over workouts due in the period. */
  private async adherenceByPlanWeek(scope: AnalyticsScope): Promise<AnalyticsPlansResponseDto['adherenceByPlanWeek']> {
    const rows = await this.db.select<{ week: string; done: string; missed: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT w.week_number AS week,
              COUNT(*) FILTER (WHERE w.status = 'completed') AS done,
              COUNT(*) FILTER (WHERE w.status = 'skipped') AS missed
         FROM workouts w
         JOIN eligible e ON e.athlete_id = w.athlete_id
        WHERE w.deleted_at IS NULL AND w.plan_id IS NOT NULL AND w.type <> 'rest'
          AND w.week_number BETWEEN 1 AND :maxWeeks
          AND ${localDay('w.scheduled_at')} BETWEEN :from AND :to
        GROUP BY 1
        ORDER BY 1`,
      scope,
      { maxWeeks: PLAN_WEEKS_MAX },
    );
    return rows
      .map((row) => {
        const done = toNumber(row.done);
        const missed = toNumber(row.missed);
        return { planWeek: toNumber(row.week), adherencePct: share(done, done + missed), workouts: done + missed };
      })
      .filter((row) => row.workouts > 0);
  }

  private async goalTypes(scope: AnalyticsScope): Promise<AnalyticsPlansResponseDto['goalTypes']> {
    const rows = await this.db.select<{ type: string; goals: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT g.type, COUNT(*) AS goals
         FROM athlete_goals g
         JOIN eligible e ON e.athlete_id = g.athlete_id
        WHERE g.deleted_at IS NULL AND g.status = 'active'
        GROUP BY 1
        ORDER BY 2 DESC`,
      scope,
    );
    return rows.map((row) => ({
      goalType: row.type,
      category: GOAL_TYPE_CATEGORY[row.type as keyof typeof GOAL_TYPE_CATEGORY] ?? 'flexible',
      goals: toNumber(row.goals),
    }));
  }

  /** Active race goals with the race date in the next 30 days. */
  private async upcomingRaces(scope: AnalyticsScope): Promise<AnalyticsPlansResponseDto['upcomingRaces']> {
    const rows = await this.db.select<{ meters: string | null; race_distance: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT (g.payload->'target'->>'distanceMeters')::numeric AS meters, g.race_distance
         FROM athlete_goals g
         JOIN eligible e ON e.athlete_id = g.athlete_id
        WHERE g.deleted_at IS NULL AND g.status = 'active' AND g.type IN (:raceTypes)
          AND g.target_date BETWEEN :today AND (:today::date + 30)`,
      scope,
      { raceTypes: RACE_GOAL_TYPES },
    );
    const counts = new Map<string, number>();
    for (const row of rows) {
      const meters = toNumberOrNull(row.meters) ?? LEGACY_DISTANCE_M[row.race_distance] ?? null;
      const match =
        meters === null ? null : RACE_DISTANCES.find((entry) => Math.abs(entry.meters - meters) / entry.meters <= 0.03);
      const key = match?.key ?? 'other';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return {
      total: rows.length,
      byDistance: [...RACE_DISTANCES.map((entry) => entry.key), 'other'].map((distance) => ({
        distance,
        races: counts.get(distance) ?? 0,
      })),
    };
  }

  private async adaptations(scope: AnalyticsScope): Promise<AnalyticsPlansResponseDto['adaptations']> {
    const row = await this.db.one<{ proposed: string; applied: string; dismissed: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(*) AS proposed,
              COUNT(*) FILTER (WHERE a.status = 'applied') AS applied,
              COUNT(*) FILTER (WHERE a.status = 'dismissed') AS dismissed
         FROM adaptation_events a
         JOIN eligible e ON e.athlete_id = a.athlete_id
        WHERE a.deleted_at IS NULL AND ${localDay('a.created_at')} BETWEEN :from AND :to`,
      scope,
    );
    const applied = toNumber(row.applied);
    const dismissed = toNumber(row.dismissed);
    return {
      proposed: toNumber(row.proposed),
      applied,
      dismissed,
      acceptanceRate: share(applied, applied + dismissed),
    };
  }
}
