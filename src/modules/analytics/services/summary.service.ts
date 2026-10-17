import { Injectable } from '@nestjs/common';

import { addDaysToDateKey } from '@/modules/training/admin-calendar-day.util';

import { ACTIVATION_DAYS } from '../analytics.constants';
import type { AnalyticsSummaryResponseDto } from '../dto/analytics-response.dto';
import { type AnalyticsScope, deltaPct, median, round1, share } from '../lib/analytics-period';
import { COMPLETED_WORKOUT, ELIGIBLE_CTE, localDay, toDateKey, toNumber, WORKOUT_KM } from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';

interface PeriodRow {
  current: string;
  previous: string;
}

/** The KPI cards at the top of the dashboard. */
@Injectable()
export class SummaryService {
  constructor(private readonly db: AnalyticsDbService) {}

  async summary(scope: AnalyticsScope): Promise<Omit<AnalyticsSummaryResponseDto, 'generatedAt'>> {
    const [runners, adherence, goals, newUsers, stickiness, records, distance, coach] = await Promise.all([
      this.weeklyActiveRunners(scope),
      this.planAdherence(scope),
      this.goalsAchieved(scope),
      this.newUsers(scope),
      this.stickiness(scope),
      this.personalRecords(scope),
      this.distance(scope),
      this.coachActiveUsers(scope),
    ]);
    return {
      weeklyActiveRunners: runners,
      planAdherence: adherence,
      goalsAchieved: goals,
      newUsers,
      stickiness,
      personalRecords: records,
      distanceKm: distance,
      coachActiveUsers: coach,
    };
  }

  private async weeklyActiveRunners(scope: AnalyticsScope): Promise<AnalyticsSummaryResponseDto['weeklyActiveRunners']> {
    const ends = this.db.bucketEnds(scope);
    // Eight weekly points ending today tell whether the number keeps growing.
    const weekly = Array.from({ length: 8 }, (_, index) => addDaysToDateKey(scope.today, -7 * index));
    const values = await this.db.rollingRunners(scope, [...new Set([...ends, ...weekly, scope.prevTo])]);
    const value = values.get(scope.today) ?? 0;
    const previous = values.get(scope.prevTo) ?? 0;
    let growthWeeks = 0;
    for (let index = 0; index < weekly.length - 1; index += 1) {
      if ((values.get(weekly[index]) ?? 0) > (values.get(weekly[index + 1]) ?? 0)) growthWeeks += 1;
      else break;
    }
    return {
      value,
      previous,
      deltaPct: deltaPct(value, previous),
      spark: ends.map((end) => values.get(end) ?? 0),
      growthWeeks,
    };
  }

  private async planAdherence(scope: AnalyticsScope): Promise<AnalyticsSummaryResponseDto['planAdherence']> {
    const day = localDay('w.scheduled_at');
    const totals = await this.db.one<{ done: string; missed: string; prev_done: string; prev_missed: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(*) FILTER (WHERE w.status = 'completed' AND ${day} BETWEEN :from AND :to) AS done,
              COUNT(*) FILTER (WHERE w.status = 'skipped' AND ${day} BETWEEN :from AND :to) AS missed,
              COUNT(*) FILTER (WHERE w.status = 'completed' AND ${day} BETWEEN :prevFrom AND :prevTo) AS prev_done,
              COUNT(*) FILTER (WHERE w.status = 'skipped' AND ${day} BETWEEN :prevFrom AND :prevTo) AS prev_missed
         FROM workouts w
         JOIN eligible e ON e.athlete_id = w.athlete_id
        WHERE w.deleted_at IS NULL AND w.plan_id IS NOT NULL AND w.type <> 'rest'
          AND w.scheduled_at >= (:prevFrom::date - 1) AND w.scheduled_at < (:to::date + 2)`,
      scope,
    );
    const keys = this.db.buckets(scope);
    const series = await this.db.select<{ bucket: unknown; done: string; missed: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT ${this.db.bucketOf(scope, 'w.scheduled_at')} AS bucket,
              COUNT(*) FILTER (WHERE w.status = 'completed') AS done,
              COUNT(*) FILTER (WHERE w.status = 'skipped') AS missed
         FROM workouts w
         JOIN eligible e ON e.athlete_id = w.athlete_id
        WHERE w.deleted_at IS NULL AND w.plan_id IS NOT NULL AND w.type <> 'rest'
          AND ${day} BETWEEN :from AND :to
        GROUP BY 1`,
      scope,
    );
    const value = share(toNumber(totals.done), toNumber(totals.done) + toNumber(totals.missed)) ?? 0;
    const previous = share(toNumber(totals.prev_done), toNumber(totals.prev_done) + toNumber(totals.prev_missed)) ?? 0;
    const spark = this.db.fill(
      keys,
      series.map((row) => ({
        bucket: row.bucket,
        value: share(toNumber(row.done), toNumber(row.done) + toNumber(row.missed)) ?? 0,
      })),
    );
    return { value, previous, deltaPct: deltaPct(value, previous), spark };
  }

  private async goalsAchieved(scope: AnalyticsScope): Promise<AnalyticsSummaryResponseDto['goalsAchieved']> {
    const rows = await this.db.select<{ status: string; first_day: unknown }>(
      `WITH ${ELIGIBLE_CTE},
       finished AS (
         SELECT s.goal_id, s.status, MIN(s.date) AS first_day
           FROM goal_progress_snapshots s
          WHERE s.status IN ('achieved', 'missed', 'abandoned')
            AND s.athlete_id IN (SELECT athlete_id FROM eligible WHERE athlete_id IS NOT NULL)
          GROUP BY s.goal_id, s.status
       ),
       first_final AS (
         SELECT DISTINCT ON (goal_id) goal_id, status, first_day FROM finished ORDER BY goal_id, first_day
       )
       SELECT status, first_day FROM first_final WHERE first_day BETWEEN :prevFrom AND :to`,
      scope,
    );
    const inCurrent = rows.filter((row) => toDateKey(row.first_day) >= scope.from);
    const inPrevious = rows.filter((row) => toDateKey(row.first_day) < scope.from);
    const achieved = inCurrent.filter((row) => row.status === 'achieved');
    const value = achieved.length;
    const previous = inPrevious.filter((row) => row.status === 'achieved').length;
    const keys = this.db.buckets(scope);
    const bucketOf = (day: string): string =>
      scope.bucket === 'day' ? day : (keys.filter((monday) => monday <= day).pop() ?? keys[0]);
    const counts = new Map<string, number>();
    for (const row of achieved) {
      const key = bucketOf(toDateKey(row.first_day));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return {
      value,
      previous,
      deltaPct: deltaPct(value, previous),
      spark: keys.map((key) => counts.get(key) ?? 0),
      rate: share(value, inCurrent.length),
    };
  }

  private async newUsers(scope: AnalyticsScope): Promise<AnalyticsSummaryResponseDto['newUsers']> {
    const registered = localDay('e.registered_at');
    const totals = await this.db.one<PeriodRow & { activated: string; matured: string }>(
      `WITH ${ELIGIBLE_CTE},
       first_run AS (
         SELECT w.athlete_id, MIN(w.completed_at) AS at
           FROM workouts w
          WHERE ${COMPLETED_WORKOUT}
          GROUP BY w.athlete_id
       )
       SELECT COUNT(*) FILTER (WHERE ${registered} BETWEEN :from AND :to) AS current,
              COUNT(*) FILTER (WHERE ${registered} BETWEEN :prevFrom AND :prevTo) AS previous,
              COUNT(*) FILTER (
                WHERE ${registered} BETWEEN :from AND :to
                  AND f.at IS NOT NULL AND f.at <= e.registered_at + make_interval(days => :activationDays)
              ) AS activated,
              COUNT(*) FILTER (
                WHERE ${registered} BETWEEN :from AND :to
                  AND ((f.at IS NOT NULL AND f.at <= e.registered_at + make_interval(days => :activationDays))
                       OR e.registered_at <= now() - make_interval(days => :activationDays))
              ) AS matured
         FROM eligible e
         LEFT JOIN first_run f ON f.athlete_id = e.athlete_id`,
      scope,
      { activationDays: ACTIVATION_DAYS },
    );
    const keys = this.db.buckets(scope);
    const series = await this.db.select<{ bucket: unknown; value: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT ${this.db.bucketOf(scope, 'e.registered_at')} AS bucket, COUNT(*) AS value
         FROM eligible e
        WHERE ${registered} BETWEEN :from AND :to
        GROUP BY 1`,
      scope,
    );
    const value = toNumber(totals.current);
    const previous = toNumber(totals.previous);
    return {
      value,
      previous,
      deltaPct: deltaPct(value, previous),
      spark: this.db.fill(keys, series),
      activationRate: share(toNumber(totals.activated), toNumber(totals.matured)),
    };
  }

  private async stickiness(scope: AnalyticsScope): Promise<AnalyticsSummaryResponseDto['stickiness']> {
    const ends = this.db.bucketEnds(scope);
    const [daily, monthly] = await Promise.all([
      this.db.rollingActiveUsers(scope, [...new Set([...ends, scope.prevTo])], 1),
      this.db.rollingActiveUsers(scope, [scope.today, scope.prevTo], 28),
    ]);
    const averageDau = async (from: string, to: string): Promise<number> => {
      const row = await this.db.one<{ value: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT COALESCE(AVG(cnt), 0) AS value FROM (
           SELECT d::date AS day, COUNT(a.user_id) AS cnt
             FROM generate_series(:rangeFrom::date, :rangeTo::date, interval '1 day') d
             LEFT JOIN user_daily_activity a ON a.date = d::date AND a.user_id IN (SELECT user_id FROM eligible)
            GROUP BY 1
         ) per_day`,
        scope,
        { rangeFrom: from, rangeTo: to },
      );
      return toNumber(row.value);
    };
    const [dauNow, dauBefore] = await Promise.all([
      averageDau(scope.from, scope.to),
      averageDau(scope.prevFrom, scope.prevTo),
    ]);
    const mau = monthly.get(scope.today) ?? 0;
    const mauBefore = monthly.get(scope.prevTo) ?? 0;
    const value = share(dauNow, mau) ?? 0;
    const previous = share(dauBefore, mauBefore) ?? 0;
    return {
      value,
      previous,
      deltaPct: deltaPct(value, previous),
      spark: ends.map((end) => daily.get(end) ?? 0),
      dau: Math.round(dauNow),
      mau,
    };
  }

  private async personalRecords(scope: AnalyticsScope): Promise<AnalyticsSummaryResponseDto['personalRecords']> {
    const day = localDay('r.achieved_at');
    const totals = await this.db.one<PeriodRow & { firsts: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(*) FILTER (WHERE r.previous_seconds IS NOT NULL AND ${day} BETWEEN :from AND :to) AS current,
              COUNT(*) FILTER (WHERE r.previous_seconds IS NOT NULL AND ${day} BETWEEN :prevFrom AND :prevTo) AS previous,
              COUNT(*) FILTER (WHERE r.previous_seconds IS NULL AND ${day} BETWEEN :from AND :to) AS firsts
         FROM athlete_records_log r
         JOIN eligible e ON e.athlete_id = r.athlete_id
        WHERE r.achieved_at >= (:prevFrom::date - 1)`,
      scope,
    );
    const series = await this.db.select<{ bucket: unknown; value: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT ${this.db.bucketOf(scope, 'r.achieved_at')} AS bucket, COUNT(*) AS value
         FROM athlete_records_log r
         JOIN eligible e ON e.athlete_id = r.athlete_id
        WHERE r.previous_seconds IS NOT NULL AND ${day} BETWEEN :from AND :to
        GROUP BY 1`,
      scope,
    );
    const value = toNumber(totals.current);
    const previous = toNumber(totals.previous);
    return {
      value,
      previous,
      deltaPct: deltaPct(value, previous),
      spark: this.db.fill(this.db.buckets(scope), series),
      firsts: toNumber(totals.firsts),
    };
  }

  private async distance(scope: AnalyticsScope): Promise<AnalyticsSummaryResponseDto['distanceKm']> {
    const day = localDay('w.completed_at');
    const totals = await this.db.one<PeriodRow>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COALESCE(SUM(${WORKOUT_KM}) FILTER (WHERE ${day} BETWEEN :from AND :to), 0) AS current,
              COALESCE(SUM(${WORKOUT_KM}) FILTER (WHERE ${day} BETWEEN :prevFrom AND :prevTo), 0) AS previous
         FROM workouts w
         JOIN eligible e ON e.athlete_id = w.athlete_id
        WHERE ${COMPLETED_WORKOUT} AND w.completed_at >= (:prevFrom::date - 1)`,
      scope,
    );
    const series = await this.db.select<{ bucket: unknown; value: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT ${this.db.bucketOf(scope, 'w.completed_at')} AS bucket, SUM(${WORKOUT_KM}) AS value
         FROM workouts w
         JOIN eligible e ON e.athlete_id = w.athlete_id
        WHERE ${COMPLETED_WORKOUT} AND ${day} BETWEEN :from AND :to
        GROUP BY 1`,
      scope,
    );
    const weekly = await this.db.select<{ km: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT SUM(${WORKOUT_KM}) AS km
         FROM workouts w
         JOIN eligible e ON e.athlete_id = w.athlete_id
        WHERE ${COMPLETED_WORKOUT} AND ${day} BETWEEN (:today::date - 6) AND :today
        GROUP BY w.athlete_id`,
      scope,
    );
    const value = round1(toNumber(totals.current));
    const previous = round1(toNumber(totals.previous));
    const weeklyMedian = median(weekly.map((row) => toNumber(row.km)));
    return {
      value,
      previous,
      deltaPct: deltaPct(value, previous),
      spark: this.db.fill(this.db.buckets(scope), series).map(round1),
      weeklyMedianKm: weeklyMedian === null ? null : round1(weeklyMedian),
    };
  }

  private async coachActiveUsers(scope: AnalyticsScope): Promise<AnalyticsSummaryResponseDto['coachActiveUsers']> {
    const day = localDay('m.created_at');
    const totals = await this.db.one<PeriodRow>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(DISTINCT s.user_id) FILTER (WHERE ${day} BETWEEN :from AND :to) AS current,
              COUNT(DISTINCT s.user_id) FILTER (WHERE ${day} BETWEEN :prevFrom AND :prevTo) AS previous
         FROM coach_messages m
         JOIN coach_sessions s ON s.id = m.session_id
         JOIN eligible e ON e.user_id = s.user_id
        WHERE m.role = 'user' AND m.deleted_at IS NULL AND m.created_at >= (:prevFrom::date - 1)`,
      scope,
    );
    const series = await this.db.select<{ bucket: unknown; value: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT ${this.db.bucketOf(scope, 'm.created_at')} AS bucket, COUNT(DISTINCT s.user_id) AS value
         FROM coach_messages m
         JOIN coach_sessions s ON s.id = m.session_id
         JOIN eligible e ON e.user_id = s.user_id
        WHERE m.role = 'user' AND m.deleted_at IS NULL AND ${day} BETWEEN :from AND :to
        GROUP BY 1`,
      scope,
    );
    const proactive = await this.db.one<{ sent: string; replied: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(*) AS sent,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM coach_messages r
                 WHERE r.session_id = p.session_id AND r.role = 'user' AND r.deleted_at IS NULL
                   AND r.created_at > p.created_at AND r.created_at <= p.created_at + interval '24 hours'
              )) AS replied
         FROM coach_messages p
         JOIN coach_sessions s ON s.id = p.session_id
         JOIN eligible e ON e.user_id = s.user_id
        WHERE p.role = 'assistant' AND p.deleted_at IS NULL
          AND (p.metadata->>'proactive')::boolean IS TRUE
          AND ${localDay('p.created_at')} BETWEEN :from AND :to`,
      scope,
    );
    const value = toNumber(totals.current);
    const previous = toNumber(totals.previous);
    return {
      value,
      previous,
      deltaPct: deltaPct(value, previous),
      spark: this.db.fill(this.db.buckets(scope), series),
      proactiveReplyRate: share(toNumber(proactive.replied), toNumber(proactive.sent)),
    };
  }
}
