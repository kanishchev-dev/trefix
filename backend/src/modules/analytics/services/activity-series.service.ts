import { Injectable } from '@nestjs/common';

import type { AnalyticsActivityResponseDto } from '../dto/analytics-response.dto';
import { type AnalyticsScope, dateRange, round1 } from '../lib/analytics-period';
import { COMPLETED_WORKOUT, ELIGIBLE_CTE, localDay, toDateKey, toNumber, WORKOUT_KM } from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';

/** The main chart: who opened the app and who trained, day by day. */
@Injectable()
export class ActivitySeriesService {
  constructor(private readonly db: AnalyticsDbService) {}

  async series(scope: AnalyticsScope): Promise<Omit<AnalyticsActivityResponseDto, 'generatedAt' | 'range'>> {
    const day = localDay('w.completed_at');
    const [active, training] = await Promise.all([
      this.db.select<{ day: unknown; users: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT a.date AS day, COUNT(*) AS users
           FROM user_daily_activity a
          WHERE a.date BETWEEN :from AND :to AND a.user_id IN (SELECT user_id FROM eligible)
          GROUP BY a.date`,
        scope,
      ),
      this.db.select<{ day: unknown; runners: string; workouts: string; km: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT ${day} AS day, COUNT(DISTINCT w.athlete_id) AS runners, COUNT(*) AS workouts, SUM(${WORKOUT_KM}) AS km
           FROM workouts w
           JOIN eligible e ON e.athlete_id = w.athlete_id
          WHERE ${COMPLETED_WORKOUT} AND ${day} BETWEEN :from AND :to
          GROUP BY 1`,
        scope,
      ),
    ]);
    const activeByDay = new Map(active.map((row) => [toDateKey(row.day), toNumber(row.users)]));
    const trainingByDay = new Map(training.map((row) => [toDateKey(row.day), row]));
    const points = dateRange(scope.from, scope.to).map((date) => {
      const row = trainingByDay.get(date);
      return {
        date,
        activeUsers: activeByDay.get(date) ?? 0,
        runners: toNumber(row?.runners),
        workouts: toNumber(row?.workouts),
        distanceKm: round1(toNumber(row?.km)),
      };
    });
    const average = (pick: (point: (typeof points)[number]) => number): number =>
      points.length ? round1(points.reduce((sum, point) => sum + pick(point), 0) / points.length) : 0;
    return {
      points,
      averageActiveUsers: average((point) => point.activeUsers),
      averageRunners: average((point) => point.runners),
    };
  }
}
