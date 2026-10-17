import { Injectable } from '@nestjs/common';

import { ATHLETE_GOAL_CATEGORIES } from '@/modules/training/goal-taxonomy';

import { DAILY_METRICS, RACE_RESULT_BUCKETS } from '../analytics.constants';
import type { AnalyticsOutcomesResponseDto } from '../dto/analytics-response.dto';
import { type AnalyticsScope, round1, share, weekRange } from '../lib/analytics-period';
import {
  COMPLETED_WORKOUT,
  ELIGIBLE_CTE,
  localDay,
  localWeek,
  toDateKey,
  toNumber,
  toNumberOrNull,
  WORKOUT_KM,
} from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';
import { OutcomeMetricsService } from './outcome-metrics.service';

/** Goal statuses of a goal that is still going on. */
const OPEN_STATUSES = ['on_track', 'at_risk', 'no_data'];

/** Are people getting what they came for: goals, form, records, safe load. */
@Injectable()
export class OutcomesService {
  constructor(
    private readonly db: AnalyticsDbService,
    private readonly metrics: OutcomeMetricsService,
  ) {}

  async outcomes(scope: AnalyticsScope): Promise<Omit<AnalyticsOutcomesResponseDto, 'generatedAt'>> {
    const [goals, goalFunnel, raceResults, fitness, records, volume, safety] = await Promise.all([
      this.goals(scope),
      this.goalFunnel(scope),
      this.raceResults(scope),
      this.fitness(scope),
      this.records(scope),
      this.volume(scope),
      this.safety(scope),
    ]);
    return { goals, goalFunnel, raceResults, fitness, records, volume, safety };
  }

  private async goals(scope: AnalyticsScope): Promise<AnalyticsOutcomesResponseDto['goals']> {
    const [open, finished] = await Promise.all([
      this.db.select<{ snapshot_date: unknown; category: string; status: string; goals: string }>(
        `WITH ${ELIGIBLE_CTE},
         last_day AS (SELECT MAX(date) AS day FROM goal_progress_snapshots)
         SELECT s.date AS snapshot_date, s.category, s.status, COUNT(*) AS goals
           FROM goal_progress_snapshots s
           JOIN last_day ON s.date = last_day.day
           JOIN athlete_goals g ON g.id = s.goal_id AND g.deleted_at IS NULL
          WHERE s.athlete_id IN (SELECT athlete_id FROM eligible WHERE athlete_id IS NOT NULL)
            AND s.status IN (:open)
          GROUP BY 1, 2, 3`,
        scope,
        { open: OPEN_STATUSES },
      ),
      this.finishedGoals(scope),
    ]);
    const categories = ATHLETE_GOAL_CATEGORIES.map((category) => {
      const count = (
        rows: Array<{ category: string; status: string; goals?: string; count?: number }>,
        status: string,
      ): number =>
        rows
          .filter((row) => row.category === category && row.status === status)
          .reduce((sum, row) => sum + toNumber(row.goals ?? row.count), 0);
      return {
        category,
        onTrack: count(open, 'on_track'),
        atRisk: count(open, 'at_risk'),
        noData: count(open, 'no_data'),
        achieved: count(finished, 'achieved'),
        missed: count(finished, 'missed'),
        abandoned: count(finished, 'abandoned'),
      };
    });
    const total = (key: 'onTrack' | 'atRisk' | 'noData' | 'achieved' | 'missed' | 'abandoned'): number =>
      categories.reduce((sum, row) => sum + row[key], 0);
    const achieved = total('achieved');
    return {
      snapshotDate: open.length ? toDateKey(open[0].snapshot_date) : await this.lastSnapshotDate(),
      active: { onTrack: total('onTrack'), atRisk: total('atRisk'), noData: total('noData') },
      finished: {
        achieved,
        missed: total('missed'),
        abandoned: total('abandoned'),
        rate: share(achieved, achieved + total('missed') + total('abandoned')),
      },
      byCategory: categories,
    };
  }

  private async lastSnapshotDate(): Promise<string | null> {
    const row = await this.db.one<{ day: unknown }>(`SELECT MAX(date) AS day FROM goal_progress_snapshots`, null);
    return row.day ? toDateKey(row.day) : null;
  }

  /** Goals whose final status first appeared within the period, by category. */
  private async finishedGoals(
    scope: AnalyticsScope,
  ): Promise<Array<{ category: string; status: string; count: number }>> {
    const rows = await this.db.select<{ category: string; status: string; goals: string }>(
      `WITH ${ELIGIBLE_CTE},
       first_final AS (
         SELECT DISTINCT ON (s.goal_id) s.goal_id, s.category, s.status, s.date
           FROM goal_progress_snapshots s
          WHERE s.status IN ('achieved', 'missed', 'abandoned')
            AND s.athlete_id IN (SELECT athlete_id FROM eligible WHERE athlete_id IS NOT NULL)
          ORDER BY s.goal_id, s.date
       )
       SELECT category, status, COUNT(*) AS goals FROM first_final WHERE date BETWEEN :from AND :to GROUP BY 1, 2`,
      scope,
    );
    return rows.map((row) => ({ category: row.category, status: row.status, count: toNumber(row.goals) }));
  }

  /** Goals set in the last 12 months, step by step towards the result. */
  private async goalFunnel(scope: AnalyticsScope): Promise<AnalyticsOutcomesResponseDto['goalFunnel']> {
    const row = await this.db.one<Record<string, string>>(
      `WITH ${ELIGIBLE_CTE},
       goals AS (
         SELECT g.id
           FROM athlete_goals g
           JOIN eligible e ON e.athlete_id = g.athlete_id
          WHERE g.deleted_at IS NULL AND g.created_at >= (:today::date - 365)
       ),
       plans AS (
         SELECT DISTINCT ON (p.goal_id) p.goal_id, p.status, p.start_date, p.end_date, p.cancelled_at
           FROM training_plans p
           JOIN goals ON goals.id = p.goal_id
          WHERE p.deleted_at IS NULL AND p.status <> 'draft' AND p.start_date IS NOT NULL
          ORDER BY p.goal_id, p.created_at DESC
       ),
       achieved AS (
         SELECT DISTINCT s.goal_id FROM goal_progress_snapshots s JOIN goals ON goals.id = s.goal_id WHERE s.status = 'achieved'
       )
       SELECT (SELECT COUNT(*) FROM goals) AS goal_set,
              COUNT(p.goal_id) AS plan_started,
              COUNT(p.goal_id) FILTER (WHERE
                p.status = 'completed'
                OR (p.end_date > p.start_date AND
                    (COALESCE(p.cancelled_at::date, :today::date) - p.start_date)::numeric
                      / (p.end_date - p.start_date) >= 0.5)
              ) AS half_plan,
              COUNT(p.goal_id) FILTER (WHERE p.status = 'completed') AS plan_completed,
              (SELECT COUNT(*) FROM achieved) AS goal_achieved
         FROM plans p`,
      scope,
    );
    return ['goal_set', 'plan_started', 'half_plan', 'plan_completed', 'goal_achieved'].map((step) => ({
      step,
      count: toNumber(row[step]),
    }));
  }

  /** Races with a target time that finished in the period, by deviation from the target. */
  private async raceResults(scope: AnalyticsScope): Promise<AnalyticsOutcomesResponseDto['raceResults']> {
    const rows = await this.db.select<{ ratio: string }>(
      `WITH ${ELIGIBLE_CTE},
       first_final AS (
         SELECT DISTINCT ON (s.goal_id) s.goal_id, s.date, s.current_value, s.target_value
           FROM goal_progress_snapshots s
          WHERE s.category = 'race_event' AND s.status IN ('achieved', 'missed')
            AND s.current_value IS NOT NULL AND s.target_value > 0
            AND s.athlete_id IN (SELECT athlete_id FROM eligible WHERE athlete_id IS NOT NULL)
          ORDER BY s.goal_id, s.date
       )
       SELECT current_value / target_value - 1 AS ratio FROM first_final WHERE date BETWEEN :from AND :to`,
      scope,
    );
    const counts = new Map<string, number>();
    for (const row of rows) {
      const ratio = toNumber(row.ratio);
      const bucket =
        ratio <= -0.03 ? 'faster_3plus' : ratio <= 0.03 ? 'within_3' : ratio <= 0.1 ? 'slower_3_10' : 'slower_10plus';
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return RACE_RESULT_BUCKETS.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }));
  }

  private async fitness(scope: AnalyticsScope): Promise<AnalyticsOutcomesResponseDto['fitness']> {
    const [today, series] = await Promise.all([
      this.metrics.fitnessOn(scope, scope.today),
      this.dailySeries(scope, [DAILY_METRICS.THRESHOLD_PACE_CHANGE, DAILY_METRICS.FITNESS_CHANGE]),
    ]);
    return {
      ...today,
      historical: !scope.includeStaff,
      series: series.map((row) => ({
        date: row.date,
        thresholdPaceChangeMedianSec: row.values[DAILY_METRICS.THRESHOLD_PACE_CHANGE] ?? null,
        fitnessChangeMedianPct: row.values[DAILY_METRICS.FITNESS_CHANGE] ?? null,
      })),
    };
  }

  private async records(scope: AnalyticsScope): Promise<AnalyticsOutcomesResponseDto['records']> {
    const day = localDay('r.achieved_at');
    const [weekly, byDistance] = await Promise.all([
      this.db.select<{ week: unknown; improvements: string; firsts: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT ${localWeek('r.achieved_at')} AS week,
                COUNT(*) FILTER (WHERE r.previous_seconds IS NOT NULL) AS improvements,
                COUNT(*) FILTER (WHERE r.previous_seconds IS NULL) AS firsts
           FROM athlete_records_log r
           JOIN eligible e ON e.athlete_id = r.athlete_id
          WHERE ${day} BETWEEN :from AND :to
          GROUP BY 1`,
        scope,
      ),
      this.db.select<{ distance: string; improvements: string; firsts: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT r.distance,
                COUNT(*) FILTER (WHERE r.previous_seconds IS NOT NULL) AS improvements,
                COUNT(*) FILTER (WHERE r.previous_seconds IS NULL) AS firsts
           FROM athlete_records_log r
           JOIN eligible e ON e.athlete_id = r.athlete_id
          WHERE ${day} BETWEEN :from AND :to
          GROUP BY 1`,
        scope,
      ),
    ]);
    const byWeek = new Map(weekly.map((row) => [toDateKey(row.week), row]));
    const weeks = weekRange(scope.from, scope.to).map((week) => ({
      week,
      improvements: toNumber(byWeek.get(week)?.improvements),
      firsts: toNumber(byWeek.get(week)?.firsts),
    }));
    return {
      improvements: weeks.reduce((sum, row) => sum + row.improvements, 0),
      firsts: weeks.reduce((sum, row) => sum + row.firsts, 0),
      weekly: weeks,
      byDistance: byDistance.map((row) => ({
        distance: row.distance,
        improvements: toNumber(row.improvements),
        firsts: toNumber(row.firsts),
      })),
    };
  }

  /** Median weekly distance of the athletes who ran that week. */
  private async volume(scope: AnalyticsScope): Promise<AnalyticsOutcomesResponseDto['volume']> {
    const rows = await this.db.select<{ week: unknown; median_km: string; runners: string }>(
      `WITH ${ELIGIBLE_CTE},
       weekly AS (
         SELECT ${localWeek('w.completed_at')} AS week, w.athlete_id, SUM(${WORKOUT_KM}) AS km
           FROM workouts w
           JOIN eligible e ON e.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT} AND ${localDay('w.completed_at')} BETWEEN :from AND :to
          GROUP BY 1, 2
       )
       SELECT week, percentile_cont(0.5) WITHIN GROUP (ORDER BY km) AS median_km, COUNT(*) AS runners
         FROM weekly GROUP BY week`,
      scope,
    );
    const byWeek = new Map(rows.map((row) => [toDateKey(row.week), row]));
    return weekRange(scope.from, scope.to).map((week) => {
      const row = byWeek.get(week);
      const value = toNumberOrNull(row?.median_km);
      return { week, medianKm: value === null ? null : round1(value), runners: toNumber(row?.runners) };
    });
  }

  private async safety(scope: AnalyticsScope): Promise<AnalyticsOutcomesResponseDto['safety']> {
    const [current, series] = await Promise.all([
      this.metrics.overloadShareOn(scope, scope.today),
      this.dailySeries(scope, [DAILY_METRICS.OVERLOAD_SHARE]),
    ]);
    return {
      currentShare: current,
      historical: !scope.includeStaff,
      series: series.map((row) => ({ date: row.date, share: row.values[DAILY_METRICS.OVERLOAD_SHARE] ?? null })),
    };
  }

  /** Stored daily metrics at the bucket ends of the period (only computed without staff). */
  private async dailySeries(
    scope: AnalyticsScope,
    metrics: string[],
  ): Promise<Array<{ date: string; values: Record<string, number | null> }>> {
    if (scope.includeStaff) return [];
    const ends = this.db.bucketEnds(scope);
    const rows = await this.db.select<{ date: unknown; metric: string; value: string }>(
      `SELECT date, metric, value FROM analytics_daily_metrics
        WHERE metric IN (:metrics) AND dimension = '' AND date IN (:dates)`,
      null,
      { metrics, dates: ends },
    );
    const byDate = new Map<string, Record<string, number | null>>();
    for (const row of rows) {
      const date = toDateKey(row.date);
      const entry = byDate.get(date) ?? {};
      entry[row.metric] = toNumberOrNull(row.value);
      byDate.set(date, entry);
    }
    return ends.map((date) => ({ date, values: byDate.get(date) ?? {} }));
  }
}
