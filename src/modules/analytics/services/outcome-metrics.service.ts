import { Injectable } from '@nestjs/common';

import { FITNESS_STABLE_PACE_SEC, FITNESS_WINDOW_WEEKS, OVERLOAD_RATIO } from '../analytics.constants';
import { type AnalyticsScope, median, round1 } from '../lib/analytics-period';
import { COMPLETED_WORKOUT, ELIGIBLE_CTE, localDay, toNumber, toNumberOrNull, WORKOUT_KM } from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';

export interface FitnessOnDay {
  athletes: number;
  improved: number;
  stable: number;
  declined: number;
  thresholdPaceChangeMedianSec: number | null;
  fitnessChangeMedianPct: number | null;
}

/**
 * "As of a day" metrics of how athletes are doing. The dashboard asks for
 * today; the nightly job stores past days in `analytics_daily_metrics`.
 */
@Injectable()
export class OutcomeMetricsService {
  constructor(private readonly db: AnalyticsDbService) {}

  /**
   * Change of threshold pace and fitness over the last 8 weeks for athletes
   * who trained at least once a week on average. Pace change is in s/km,
   * negative is faster.
   */
  async fitnessOn(scope: AnalyticsScope, day: string): Promise<FitnessOnDay> {
    const windowDays = FITNESS_WINDOW_WEEKS * 7;
    const rows = await this.db.select<{ pace_change: string | null; fitness_change: string | null }>(
      `WITH ${ELIGIBLE_CTE},
       latest AS (
         SELECT DISTINCT ON (s.athlete_id) s.athlete_id, s.threshold_pace_seconds_per_km AS pace, s.fitness
           FROM athlete_states s
           JOIN eligible e ON e.athlete_id = s.athlete_id
          WHERE s.created_at < (:day::date + 1) AND s.created_at >= (:day::date - 13)
          ORDER BY s.athlete_id, s.created_at DESC
       ),
       earlier AS (
         SELECT DISTINCT ON (s.athlete_id) s.athlete_id, s.threshold_pace_seconds_per_km AS pace, s.fitness
           FROM athlete_states s
           JOIN eligible e ON e.athlete_id = s.athlete_id
          WHERE s.created_at < (:day::date - :window + 1) AND s.created_at >= (:day::date - :window - 27)
          ORDER BY s.athlete_id, s.created_at DESC
       ),
       regular AS (
         SELECT w.athlete_id
           FROM workouts w
          WHERE ${COMPLETED_WORKOUT}
            AND w.completed_at >= (:day::date - :window + 1) AND w.completed_at < (:day::date + 1)
          GROUP BY w.athlete_id
         HAVING COUNT(*) >= :minWorkouts
       )
       SELECT CASE WHEN l.pace > 0 AND b.pace > 0 THEN l.pace - b.pace END AS pace_change,
              CASE WHEN b.fitness > 0 THEN (l.fitness - b.fitness) / b.fitness * 100 END AS fitness_change
         FROM latest l
         JOIN earlier b ON b.athlete_id = l.athlete_id
         JOIN regular r ON r.athlete_id = l.athlete_id`,
      scope,
      { day, window: windowDays, minWorkouts: FITNESS_WINDOW_WEEKS },
    );
    const paces = rows.map((row) => toNumberOrNull(row.pace_change)).filter((value): value is number => value !== null);
    const fitness = rows
      .map((row) => toNumberOrNull(row.fitness_change))
      .filter((value): value is number => value !== null);
    const paceMedian = median(paces);
    const fitnessMedian = median(fitness);
    return {
      athletes: paces.length,
      improved: paces.filter((value) => value <= -FITNESS_STABLE_PACE_SEC).length,
      stable: paces.filter((value) => Math.abs(value) < FITNESS_STABLE_PACE_SEC).length,
      declined: paces.filter((value) => value >= FITNESS_STABLE_PACE_SEC).length,
      thresholdPaceChangeMedianSec: paceMedian === null ? null : round1(paceMedian),
      fitnessChangeMedianPct: fitnessMedian === null ? null : round1(fitnessMedian),
    };
  }

  /** Share (%) of recently training athletes whose acute load outgrows the chronic one. */
  async overloadShareOn(scope: AnalyticsScope, day: string): Promise<number | null> {
    const row = await this.db.one<{ total: string; overloaded: string }>(
      `WITH ${ELIGIBLE_CTE},
       recent AS (
         SELECT DISTINCT w.athlete_id
           FROM workouts w
           JOIN eligible e ON e.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT} AND w.completed_at >= (:day::date - 27) AND w.completed_at < (:day::date + 1)
       ),
       latest AS (
         SELECT DISTINCT ON (s.athlete_id) s.athlete_id, s.acute_load, s.chronic_load
           FROM athlete_states s
           JOIN recent r ON r.athlete_id = s.athlete_id
          WHERE s.created_at < (:day::date + 1) AND s.created_at >= (:day::date - 6)
          ORDER BY s.athlete_id, s.created_at DESC
       )
       SELECT COUNT(*) FILTER (WHERE chronic_load > 0) AS total,
              COUNT(*) FILTER (WHERE chronic_load > 0 AND acute_load / chronic_load > :ratio) AS overloaded
         FROM latest`,
      scope,
      { day, ratio: OVERLOAD_RATIO },
    );
    const total = toNumber(row.total);
    return total ? round1((toNumber(row.overloaded) / total) * 100) : null;
  }

  /** Median distance over the 7 days ending at `day` among athletes who ran in them. */
  async weeklyKmMedianOn(scope: AnalyticsScope, day: string): Promise<number | null> {
    const rows = await this.db.select<{ km: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT SUM(${WORKOUT_KM}) AS km
         FROM workouts w
         JOIN eligible e ON e.athlete_id = w.athlete_id
        WHERE ${COMPLETED_WORKOUT} AND ${localDay('w.completed_at')} BETWEEN (:day::date - 6) AND :day
        GROUP BY w.athlete_id`,
      scope,
      { day },
    );
    const value = median(rows.map((row) => toNumber(row.km)));
    return value === null ? null : round1(value);
  }
}
