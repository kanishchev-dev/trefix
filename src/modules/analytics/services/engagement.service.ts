import { Injectable } from '@nestjs/common';

import { addDaysToDateKey } from '@/modules/training/admin-calendar-day.util';

import { COHORT_WEEKS, FIRST_WORKOUT_BUCKETS, HABIT_WEEKS, WORKOUT_SOURCE_KEYS } from '../analytics.constants';
import type { AnalyticsEngagementResponseDto } from '../dto/analytics-response.dto';
import { type AnalyticsScope, median, mondayOf, round1, share, weekRange } from '../lib/analytics-period';
import {
  COMPLETED_WORKOUT,
  ELIGIBLE_CTE,
  localDay,
  localWeek,
  toDateKey,
  toNumber,
  toNumberOrNull,
} from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';

/** Primary source of a completed workout; no source at all means it was entered by hand. */
const WORKOUT_SOURCE = `COALESCE(
  (SELECT ws.provider FROM workout_sources ws
    WHERE ws.workout_id = w.id AND ws.deleted_at IS NULL
    ORDER BY ws.is_primary DESC LIMIT 1),
  w.source_provider,
  'manual')`;

/** Habit formation, regularity and when people run. */
@Injectable()
export class EngagementService {
  constructor(private readonly db: AnalyticsDbService) {}

  async engagement(scope: AnalyticsScope): Promise<Omit<AnalyticsEngagementResponseDto, 'generatedAt'>> {
    const [regularity, activeDays, cohorts, habit, timeToFirstWorkout, sources, whenTheyRun, stickinessSeries] =
      await Promise.all([
        this.regularity(scope),
        this.activeDays(scope),
        this.cohorts(scope),
        this.habit(scope),
        this.timeToFirstWorkout(scope),
        this.sources(scope),
        this.whenTheyRun(scope),
        this.stickinessSeries(scope),
      ]);
    return { regularity, activeDays, cohorts, habit, timeToFirstWorkout, sources, whenTheyRun, stickinessSeries };
  }

  /** Runners of the last 8 weeks by the number of weeks they trained in. */
  private async regularity(scope: AnalyticsScope): Promise<AnalyticsEngagementResponseDto['regularity']> {
    const day = localDay('w.completed_at');
    const rows = await this.db.select<{ weeks: string; users: string }>(
      `WITH ${ELIGIBLE_CTE},
       runs AS (
         SELECT w.athlete_id, (:today::date - ${day}) / 7 AS week_index
           FROM workouts w
           JOIN eligible e ON e.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT} AND ${day} BETWEEN (:today::date - 55) AND :today
       )
       SELECT weeks, COUNT(*) AS users
         FROM (SELECT athlete_id, COUNT(DISTINCT week_index) AS weeks FROM runs GROUP BY athlete_id) per_athlete
        GROUP BY weeks`,
      scope,
    );
    const byWeeks = new Map(rows.map((row) => [toNumber(row.weeks), toNumber(row.users)]));
    return Array.from({ length: 8 }, (_, index) => ({ weeks: index + 1, users: byWeeks.get(index + 1) ?? 0 }));
  }

  /** Runners of the last 28 days by the number of days they trained on. */
  private async activeDays(scope: AnalyticsScope): Promise<AnalyticsEngagementResponseDto['activeDays']> {
    const day = localDay('w.completed_at');
    const rows = await this.db.select<{ days: string; users: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT days, COUNT(*) AS users
         FROM (
           SELECT w.athlete_id, COUNT(DISTINCT ${day}) AS days
             FROM workouts w
             JOIN eligible e ON e.athlete_id = w.athlete_id
            WHERE ${COMPLETED_WORKOUT} AND ${day} BETWEEN (:today::date - 27) AND :today
            GROUP BY w.athlete_id
         ) per_athlete
        GROUP BY days`,
      scope,
    );
    const byDays = new Map(rows.map((row) => [toNumber(row.days), toNumber(row.users)]));
    return Array.from({ length: 28 }, (_, index) => ({ days: index + 1, users: byDays.get(index + 1) ?? 0 }));
  }

  /** Weekly registration cohorts of the last 12 weeks: share with a workout N weeks later. */
  private async cohorts(scope: AnalyticsScope): Promise<AnalyticsEngagementResponseDto['cohorts']> {
    const currentWeek = mondayOf(scope.today);
    const firstWeek = addDaysToDateKey(currentWeek, -7 * (COHORT_WEEKS - 1));
    const registeredWeek = localWeek('e.registered_at');
    const [sizes, retained] = await Promise.all([
      this.db.select<{ week: unknown; size: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT ${registeredWeek} AS week, COUNT(*) AS size
           FROM eligible e
          WHERE ${registeredWeek} >= :firstWeek
          GROUP BY 1`,
        scope,
        { firstWeek },
      ),
      this.db.select<{ week: unknown; week_offset: string; users: string }>(
        `WITH ${ELIGIBLE_CTE},
         cohort AS (
           SELECT e.user_id, e.athlete_id, ${registeredWeek} AS week
             FROM eligible e
            WHERE ${registeredWeek} >= :firstWeek AND e.athlete_id IS NOT NULL
         ),
         runs AS (
           SELECT DISTINCT w.athlete_id, ${localWeek('w.completed_at')} AS week
             FROM workouts w
             JOIN cohort c ON c.athlete_id = w.athlete_id
            WHERE ${COMPLETED_WORKOUT} AND w.completed_at >= (:firstWeek::date - 1)
         )
         SELECT c.week, (r.week - c.week) / 7 AS week_offset, COUNT(DISTINCT c.user_id) AS users
           FROM cohort c
           JOIN runs r ON r.athlete_id = c.athlete_id AND r.week >= c.week
          GROUP BY 1, 2`,
        scope,
        { firstWeek },
      ),
    ]);
    const retainedByKey = new Map(
      retained.map((row) => [`${toDateKey(row.week)}:${toNumber(row.week_offset)}`, toNumber(row.users)]),
    );
    return sizes
      .map((row) => ({ week: toDateKey(row.week), size: toNumber(row.size) }))
      .sort((left, right) => left.week.localeCompare(right.week))
      .map(({ week, size }) => {
        const weeksSince = Math.round((Date.parse(currentWeek) - Date.parse(week)) / (7 * 86_400_000));
        const retention = Array.from({ length: weeksSince + 1 }, (_, offset) =>
          size ? round1(((retainedByKey.get(`${week}:${offset}`) ?? 0) / size) * 100) : 0,
        );
        return { week, size, retention };
      });
  }

  /**
   * Of the athletes whose first workout falls into the period shifted four
   * weeks back (so their first four weeks are over), how many trained in at
   * least 3 of those weeks.
   */
  private async habit(scope: AnalyticsScope): Promise<AnalyticsEngagementResponseDto['habit']> {
    const row = await this.db.one<{ started: string; formed: string }>(
      `WITH ${ELIGIBLE_CTE},
       firsts AS (
         SELECT w.athlete_id, MIN(${localDay('w.completed_at')}) AS first_day
           FROM workouts w
           JOIN eligible e ON e.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT}
          GROUP BY w.athlete_id
       ),
       cohort AS (
         SELECT * FROM firsts WHERE first_day BETWEEN (:from::date - 28) AND (:to::date - 28)
       ),
       weeks AS (
         SELECT c.athlete_id, COUNT(DISTINCT (${localDay('w.completed_at')} - c.first_day) / 7) AS weeks
           FROM cohort c
           JOIN workouts w ON w.athlete_id = c.athlete_id
          WHERE ${COMPLETED_WORKOUT}
            AND ${localDay('w.completed_at')} BETWEEN c.first_day AND c.first_day + 27
          GROUP BY c.athlete_id
       )
       SELECT COUNT(*) AS started, COUNT(*) FILTER (WHERE weeks >= :habitWeeks) AS formed FROM weeks`,
      scope,
      { habitWeeks: HABIT_WEEKS },
    );
    const started = toNumber(row.started);
    const formed = toNumber(row.formed);
    return { startedRunning: started, formedHabit: formed, rate: share(formed, started) };
  }

  /** Users registered in the period by how soon they trained for the first time. */
  private async timeToFirstWorkout(scope: AnalyticsScope): Promise<AnalyticsEngagementResponseDto['timeToFirstWorkout']> {
    const rows = await this.db.select<{ hours: string | null }>(
      `WITH ${ELIGIBLE_CTE},
       first_run AS (
         SELECT w.athlete_id, MIN(w.completed_at) AS at
           FROM workouts w
           JOIN eligible e ON e.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT}
          GROUP BY w.athlete_id
       )
       SELECT EXTRACT(EPOCH FROM (f.at - e.registered_at)) / 3600 AS hours
         FROM eligible e
         LEFT JOIN first_run f ON f.athlete_id = e.athlete_id
        WHERE ${localDay('e.registered_at')} BETWEEN :from AND :to`,
      scope,
    );
    const hours = rows.map((row) => toNumberOrNull(row.hours));
    const bucketOf = (value: number | null): (typeof FIRST_WORKOUT_BUCKETS)[number] => {
      if (value === null) return 'never';
      const days = Math.max(value, 0) / 24;
      if (days < 1) return 'day1';
      if (days < 3) return 'days2_3';
      if (days < 7) return 'days4_7';
      if (days < 14) return 'days8_14';
      return 'later';
    };
    const counts = new Map<string, number>();
    for (const value of hours) {
      const bucket = bucketOf(value);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    const known = hours.filter((value): value is number => value !== null).map((value) => Math.max(value, 0));
    const medianHours = median(known);
    return {
      medianHours: medianHours === null ? null : round1(medianHours),
      buckets: FIRST_WORKOUT_BUCKETS.map((bucket) => ({ bucket, users: counts.get(bucket) ?? 0 })),
    };
  }

  /** Completed workouts by week and source. */
  private async sources(scope: AnalyticsScope): Promise<AnalyticsEngagementResponseDto['sources']> {
    const day = localDay('w.completed_at');
    const rows = await this.db.select<{ week: unknown; source: string; workouts: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT ${localWeek('w.completed_at')} AS week, ${WORKOUT_SOURCE} AS source, COUNT(*) AS workouts
         FROM workouts w
         JOIN eligible e ON e.athlete_id = w.athlete_id
        WHERE ${COMPLETED_WORKOUT} AND ${day} BETWEEN :from AND :to
        GROUP BY 1, 2`,
      scope,
    );
    const known = new Set<string>(WORKOUT_SOURCE_KEYS);
    const byWeek = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const week = toDateKey(row.week);
      const entry = byWeek.get(week) ?? {};
      const source = known.has(row.source) ? row.source : 'manual';
      entry[source] = (entry[source] ?? 0) + toNumber(row.workouts);
      byWeek.set(week, entry);
    }
    return weekRange(scope.from, scope.to).map((week) => {
      const entry = byWeek.get(week) ?? {};
      return {
        week,
        trefix: entry.trefix ?? 0,
        strava: entry.strava ?? 0,
        garmin: entry.garmin ?? 0,
        appleHealth: entry.apple_health ?? 0,
        healthConnect: entry.health_connect ?? 0,
        manual: entry.manual ?? 0,
      };
    });
  }

  /** Workouts of the period by local weekday (1 = Monday) and hour of the start. */
  private async whenTheyRun(scope: AnalyticsScope): Promise<AnalyticsEngagementResponseDto['whenTheyRun']> {
    const rows = await this.db.select<{ weekday: string; hour: string; workouts: string }>(
      `WITH ${ELIGIBLE_CTE},
       starts AS (
         SELECT COALESCE(
                  (SELECT CASE WHEN ws.utc_offset_minutes IS NOT NULL
                               THEN (ws.started_at AT TIME ZONE 'UTC') + make_interval(mins => ws.utc_offset_minutes)
                               ELSE ws.started_at AT TIME ZONE :tz END
                     FROM workout_sources ws
                    WHERE ws.workout_id = w.id AND ws.deleted_at IS NULL
                    ORDER BY ws.is_primary DESC LIMIT 1),
                  w.completed_at AT TIME ZONE :tz) AS local_start
           FROM workouts w
           JOIN eligible e ON e.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT} AND ${localDay('w.completed_at')} BETWEEN :from AND :to
       )
       SELECT EXTRACT(ISODOW FROM local_start) AS weekday, EXTRACT(HOUR FROM local_start) AS hour, COUNT(*) AS workouts
         FROM starts
        GROUP BY 1, 2`,
      scope,
    );
    return rows
      .map((row) => ({ weekday: toNumber(row.weekday), hour: toNumber(row.hour), workouts: toNumber(row.workouts) }))
      .sort((left, right) => left.weekday - right.weekday || left.hour - right.hour);
  }

  private async stickinessSeries(scope: AnalyticsScope): Promise<AnalyticsEngagementResponseDto['stickinessSeries']> {
    const ends = this.db.bucketEnds(scope);
    const [dau, wau, mau] = await Promise.all([
      this.db.rollingActiveUsers(scope, ends, 1),
      this.db.rollingActiveUsers(scope, ends, 7),
      this.db.rollingActiveUsers(scope, ends, 28),
    ]);
    return ends.map((date) => {
      const daily = dau.get(date) ?? 0;
      const monthly = mau.get(date) ?? 0;
      return { date, dau: daily, wau: wau.get(date) ?? 0, mau: monthly, stickiness: share(daily, monthly) };
    });
  }
}
