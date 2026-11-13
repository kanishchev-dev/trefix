import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { addDaysToDateKey } from '@/modules/training/admin-calendar-day.util';

import { type AnalyticsScope, dateRange, weekRange } from '../lib/analytics-period';
import {
  COMPLETED_WORKOUT,
  ELIGIBLE_CTE,
  localDay,
  scopeReplacements,
  toDateKey,
  toNumber,
} from '../lib/analytics-sql';

/**
 * Read-only access to the database for the dashboard. Aggregations run as raw
 * SQL over the domain tables; domain rules (goal progress, records) come from
 * the services the training module exports.
 */
@Injectable()
export class AnalyticsDbService {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  select<T extends object>(
    sql: string,
    scope: AnalyticsScope | null,
    replacements: Record<string, unknown> = {},
  ): Promise<T[]> {
    return this.sequelize.query<T>(sql, {
      replacements: { ...(scope ? scopeReplacements(scope) : {}), ...replacements },
      type: QueryTypes.SELECT,
    });
  }

  async one<T extends object>(
    sql: string,
    scope: AnalyticsScope | null,
    replacements: Record<string, unknown> = {},
  ): Promise<T> {
    const rows = await this.select<T>(sql, scope, replacements);
    return rows[0] ?? ({} as T);
  }

  /** Bucket keys of the current period: days, or Mondays for the yearly period. */
  buckets(scope: AnalyticsScope): string[] {
    return scope.bucket === 'day' ? dateRange(scope.from, scope.to) : weekRange(scope.from, scope.to);
  }

  /** Last day of each bucket, clipped to today; rolling metrics are taken there. */
  bucketEnds(scope: AnalyticsScope): string[] {
    if (scope.bucket === 'day') return this.buckets(scope);
    return this.buckets(scope).map((monday) => {
      const sunday = addDaysToDateKey(monday, 6);
      return sunday > scope.today ? scope.today : sunday;
    });
  }

  /** SQL expression of the bucket a timestamp column falls into. */
  bucketOf(scope: AnalyticsScope, column: string): string {
    return scope.bucket === 'day' ? localDay(column) : `date_trunc('week', ${column} AT TIME ZONE :tz)::date`;
  }

  /** Rows keyed by bucket mapped onto every bucket of the period (missing ones are 0). */
  fill(keys: string[], rows: Array<{ bucket: unknown; value: unknown }>): number[] {
    const byKey = new Map(rows.map((row) => [toDateKey(row.bucket), toNumber(row.value)]));
    return keys.map((key) => byKey.get(key) ?? 0);
  }

  /** Athletes with at least one workout in the `windowDays` days ending at each date. */
  async rollingRunners(scope: AnalyticsScope, dates: string[], windowDays = 7): Promise<Map<string, number>> {
    if (dates.length === 0) return new Map();
    const rows = await this.select<{ d: unknown; value: string }>(
      `WITH ${ELIGIBLE_CTE},
       days AS (SELECT unnest(ARRAY[:dates]::date[]) AS d),
       runs AS (
         SELECT DISTINCT w.athlete_id, ${localDay('w.completed_at')} AS day
           FROM workouts w
           JOIN eligible e ON e.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT}
            AND w.completed_at >= (:minDate::date - :window - 1)
            AND w.completed_at < (:maxDate::date + 2)
       )
       SELECT days.d, COUNT(DISTINCT runs.athlete_id) AS value
         FROM days
         LEFT JOIN runs ON runs.day BETWEEN days.d - (:window - 1) AND days.d
        GROUP BY days.d`,
      scope,
      {
        dates,
        window: windowDays,
        minDate: dates.reduce((a, b) => (a < b ? a : b)),
        maxDate: dates.reduce((a, b) => (a > b ? a : b)),
      },
    );
    return new Map(rows.map((row) => [toDateKey(row.d), toNumber(row.value)]));
  }

  /** Distinct active users (opened the app) in the `windowDays` days ending at each date. */
  async rollingActiveUsers(scope: AnalyticsScope, dates: string[], windowDays: number): Promise<Map<string, number>> {
    if (dates.length === 0) return new Map();
    const rows = await this.select<{ d: unknown; value: string }>(
      `WITH ${ELIGIBLE_CTE},
       days AS (SELECT unnest(ARRAY[:dates]::date[]) AS d)
       SELECT days.d, COUNT(DISTINCT a.user_id) AS value
         FROM days
         LEFT JOIN user_daily_activity a ON a.date BETWEEN days.d - (:window - 1) AND days.d
          AND a.user_id IN (SELECT user_id FROM eligible)
        GROUP BY days.d`,
      scope,
      { dates, window: windowDays },
    );
    return new Map(rows.map((row) => [toDateKey(row.d), toNumber(row.value)]));
  }
}
