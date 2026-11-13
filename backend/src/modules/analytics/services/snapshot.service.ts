import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';

import { addDaysToDateKey, toLocalDateKey } from '@/modules/training/admin-calendar-day.util';
import { GoalProgressService } from '@/modules/training/goals/goal-progress.service';

import {
  ANALYTICS_DEFAULT_TIMEZONE,
  ANALYTICS_SNAPSHOT_BATCH,
  ANALYTICS_SNAPSHOT_RECOMPUTE_DAYS,
  DAILY_METRICS,
} from '../analytics.constants';
import { AnalyticsDailyMetric } from '../entities/analytics-daily-metric.entity';
import { GoalProgressSnapshot } from '../entities/goal-progress-snapshot.entity';
import { type AnalyticsScope, dateRange, resolveScope } from '../lib/analytics-period';
import { AnalyticsDbService } from './analytics-db.service';
import { OutcomeMetricsService } from './outcome-metrics.service';

/**
 * Nightly work: snapshots of goal progress for today and the daily metrics of
 * the last few days (recomputed so late imports land in the right day).
 */
@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    @InjectModel(GoalProgressSnapshot) private readonly snapshotModel: typeof GoalProgressSnapshot,
    @InjectModel(AnalyticsDailyMetric) private readonly metricModel: typeof AnalyticsDailyMetric,
    private readonly goalProgressService: GoalProgressService,
    private readonly db: AnalyticsDbService,
    private readonly outcomeMetrics: OutcomeMetricsService,
    private readonly configService: ConfigService,
  ) {}

  private timezone(): string {
    return this.configService.get<string>('analytics.defaultTimezone') ?? ANALYTICS_DEFAULT_TIMEZONE;
  }

  async runDaily(now = new Date()): Promise<{ goals: number; days: number }> {
    const today = toLocalDateKey(now, this.timezone());
    const goals = await this.snapshotGoals(today);
    const days = await this.computeDailyMetrics(
      addDaysToDateKey(today, -ANALYTICS_SNAPSHOT_RECOMPUTE_DAYS),
      today,
      now,
    );
    this.logger.log(`Analytics snapshot ${today}: ${goals} goals, ${days} days of metrics`);
    return { goals, days };
  }

  /** Judges every current goal and stores the result under `today`. */
  async snapshotGoals(today: string): Promise<number> {
    let after: string | null = null;
    let total = 0;
    for (;;) {
      const athleteIds = await this.goalProgressService.athletesWithGoals(today, after, ANALYTICS_SNAPSHOT_BATCH);
      if (athleteIds.length === 0) break;
      const evaluations = await this.goalProgressService.evaluateForAthletes(athleteIds, today);
      if (evaluations.length) {
        await this.snapshotModel.bulkCreate(
          evaluations.map((entry) => ({
            goalId: entry.goalId,
            date: today,
            athleteId: entry.athleteId,
            category: entry.progress.category,
            goalType: entry.goalType.slice(0, 32),
            status: entry.progress.status,
            progressPct: entry.progress.progressPct === null ? null : String(entry.progress.progressPct),
            currentValue: entry.progress.current === null ? null : String(entry.progress.current),
            targetValue: entry.progress.target === null ? null : String(entry.progress.target),
            targetDate: entry.targetDate,
          })),
          {
            updateOnDuplicate: [
              'athleteId',
              'category',
              'goalType',
              'status',
              'progressPct',
              'currentValue',
              'targetValue',
              'targetDate',
            ],
          },
        );
      }
      total += evaluations.length;
      after = athleteIds[athleteIds.length - 1];
      if (athleteIds.length < ANALYTICS_SNAPSHOT_BATCH) break;
    }
    return total;
  }

  /** Daily metrics for every day of the range, without staff. */
  async computeDailyMetrics(from: string, to: string, now = new Date()): Promise<number> {
    const scope: AnalyticsScope = resolveScope('7d', this.timezone(), false, now);
    const days = dateRange(from, to);
    const [dau, wau, mau, war] = await Promise.all([
      this.db.rollingActiveUsers(scope, days, 1),
      this.db.rollingActiveUsers(scope, days, 7),
      this.db.rollingActiveUsers(scope, days, 28),
      this.db.rollingRunners(scope, days, 7),
    ]);
    for (const day of days) {
      const [fitness, overload, weeklyKm] = await Promise.all([
        this.outcomeMetrics.fitnessOn(scope, day),
        this.outcomeMetrics.overloadShareOn(scope, day),
        this.outcomeMetrics.weeklyKmMedianOn(scope, day),
      ]);
      const values: Array<[string, number | null]> = [
        [DAILY_METRICS.DAU, dau.get(day) ?? 0],
        [DAILY_METRICS.WAU, wau.get(day) ?? 0],
        [DAILY_METRICS.MAU, mau.get(day) ?? 0],
        [DAILY_METRICS.WAR, war.get(day) ?? 0],
        [DAILY_METRICS.THRESHOLD_PACE_CHANGE, fitness.thresholdPaceChangeMedianSec],
        [DAILY_METRICS.FITNESS_CHANGE, fitness.fitnessChangeMedianPct],
        [DAILY_METRICS.OVERLOAD_SHARE, overload],
        [DAILY_METRICS.WEEKLY_KM_MEDIAN, weeklyKm],
      ];
      const rows = values
        .filter((entry): entry is [string, number] => entry[1] !== null)
        .map(([metric, value]) => ({ date: day, metric, dimension: '', value: String(value), computedAt: new Date() }));
      if (rows.length) {
        await this.metricModel.bulkCreate(rows, { updateOnDuplicate: ['value', 'computedAt'] });
      }
    }
    return days.length;
  }
}
