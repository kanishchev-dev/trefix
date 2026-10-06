import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { Athlete } from '../entities/athlete.entity';
import { AthleteState } from '../entities/athlete-state.entity';
import { Workout } from '../entities/workout.entity';
import type { PlanMetricsSource } from '../training.constants';
import { ATHLETE_GOAL_DISTANCES, PLAN_METRIC_RANGES } from '../training.constants';
import type { AthleteMetrics } from '../training.engine';

/** Per-field provenance of an estimated metric. */
export interface SourcedValue<T> {
  value: T;
  source: PlanMetricsSource;
}

export interface CurrentMetrics {
  thresholdPaceSecondsPerKm: SourcedValue<number | null>;
  thresholdHeartRate: SourcedValue<number | null>;
  maxHeartRate: SourcedValue<number | null>;
  restingHeartRate: SourcedValue<number | null>;
  weeklyMileageKm: SourcedValue<number | null>;
  longestRunKm: SourcedValue<number | null>;
  recentResult: SourcedValue<{ distance: string; timeSeconds: number; date: string } | null>;
}

/** Minimum completed workouts with distance before volume is estimated. */
const MIN_COMPLETED_FOR_VOLUME = 4;
const VOLUME_WINDOW_DAYS = 28;
const RESULT_WINDOW_DAYS = 56;

/**
 * Estimates the athlete's current metrics from `athlete_state` and completed
 * workouts (imported and manually logged), with per-field provenance
 *. Missing data is reported as `none`, so the
 * client can ask the user for input instead of guessing.
 */
@Injectable()
export class AthleteMetricsService {
  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectModel(AthleteState)
    private readonly athleteStateModel: typeof AthleteState,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
  ) {}

  /** Current metrics estimate for the prefill step. */
  async currentMetrics(athleteId: string): Promise<CurrentMetrics> {
    const state = await this.athleteStateModel.findOne({
      where: { athleteId },
      order: [['createdAt', 'DESC']],
    });

    const completed = await this.workoutModel.findAll({
      where: {
        athleteId,
        status: 'completed',
        completedAt: { [Op.gte]: new Date(Date.now() - RESULT_WINDOW_DAYS * 86_400_000) },
      },
      order: [['completedAt', 'DESC']],
      limit: 200,
    });

    const now = Date.now();
    const inVolumeWindow = completed.filter(
      (workout) =>
        workout.completedAt !== null && workout.completedAt.getTime() >= now - VOLUME_WINDOW_DAYS * 86_400_000,
    );
    const withDistance = inVolumeWindow.filter(
      (workout) => typeof (workout.actual as Record<string, unknown> | null)?.actualDistanceKm === 'number',
    );
    const distanceOf = (workout: Workout): number =>
      Number((workout.actual as Record<string, unknown> | null)?.actualDistanceKm ?? 0);

    const volumeAvailable = withDistance.length >= MIN_COMPLETED_FOR_VOLUME;
    const volumeSource: PlanMetricsSource = volumeAvailable
      ? withDistance.some((workout) => workout.sourceProvider === 'strava')
        ? 'strava'
        : 'manual_workouts'
      : 'none';

    const weeklyMileageKm = volumeAvailable
      ? Math.round((withDistance.reduce((sum, workout) => sum + distanceOf(workout), 0) / 4) * 10) / 10
      : null;
    const longestRunKm = volumeAvailable
      ? Math.round(Math.max(...withDistance.map((workout) => distanceOf(workout))) * 10) / 10
      : null;

    const recentResult = this.pickRecentResult(completed);

    return {
      thresholdPaceSecondsPerKm: {
        value: state?.thresholdPaceSecondsPerKm ?? null,
        source: state?.thresholdPaceSecondsPerKm ? 'athlete_state' : 'none',
      },
      thresholdHeartRate: {
        value: state?.thresholdHeartRate ?? null,
        source: state?.thresholdHeartRate ? 'athlete_state' : 'none',
      },
      maxHeartRate: { value: null, source: 'none' },
      restingHeartRate: { value: null, source: 'none' },
      weeklyMileageKm: { value: weeklyMileageKm, source: volumeSource },
      longestRunKm: { value: longestRunKm, source: volumeSource },
      recentResult,
    };
  }

  /** Flattens a current-metrics estimate into the snapshot shape. */
  toSnapshotMetrics(current: CurrentMetrics, capturedAt = new Date()): AthleteMetrics {
    return {
      capturedAt: capturedAt.toISOString(),
      thresholdPaceSecondsPerKm: current.thresholdPaceSecondsPerKm.value,
      thresholdHeartRate: current.thresholdHeartRate.value,
      maxHeartRate: current.maxHeartRate.value,
      restingHeartRate: current.restingHeartRate.value,
      weeklyMileageKm: current.weeklyMileageKm.value,
      longestRunKm: current.longestRunKm.value,
      recentResult: current.recentResult.value,
      source: this.resolveOverallSource(current),
    };
  }

  /** Validates user-entered metrics against the accepted metric ranges. */
  validateMetrics(metrics: AthleteMetrics): string[] {
    const violations: string[] = [];
    const checkRange = (field: keyof typeof PLAN_METRIC_RANGES, value: number | null | undefined): void => {
      if (value === null || value === undefined) {
        return;
      }
      const range = PLAN_METRIC_RANGES[field];
      if (value < range.min || value > range.max) {
        violations.push(`${field}_out_of_range`);
      }
    };

    checkRange('thresholdPaceSecondsPerKm', metrics.thresholdPaceSecondsPerKm);
    checkRange('weeklyMileageKm', metrics.weeklyMileageKm);
    checkRange('longestRunKm', metrics.longestRunKm);
    checkRange('maxHeartRate', metrics.maxHeartRate);
    checkRange('restingHeartRate', metrics.restingHeartRate);

    const maxHr = metrics.maxHeartRate;
    const restHr = metrics.restingHeartRate;
    if (typeof maxHr === 'number' && typeof restHr === 'number' && restHr >= maxHr) {
      violations.push('resting_heart_rate_not_below_max');
    }

    return violations;
  }

  private pickRecentResult(
    completed: Workout[],
  ): SourcedValue<{ distance: string; timeSeconds: number; date: string } | null> {
    const candidates = completed
      .map((workout) => {
        const actual = workout.actual as Record<string, unknown> | null;
        const distanceKm = Number(actual?.actualDistanceKm ?? 0);
        const durationMinutes = Number(actual?.actualDurationMinutes ?? 0);
        if (distanceKm <= 1 || durationMinutes <= 0) {
          return null;
        }
        return {
          distanceKm,
          timeSeconds: Math.round(durationMinutes * 60),
          date: workout.completedAt instanceof Date ? workout.completedAt.toISOString().slice(0, 10) : '',
          sourceProvider: workout.sourceProvider,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (candidates.length === 0) {
      return { value: null, source: 'none' };
    }

    // Best result = fastest pace over the covered distance.
    const best = candidates.reduce((left, right) =>
      right.timeSeconds / right.distanceKm < left.timeSeconds / left.distanceKm ? right : left,
    );

    return {
      value: {
        distance: this.mapDistanceName(best.distanceKm),
        timeSeconds: best.timeSeconds,
        date: best.date,
      },
      source: best.sourceProvider === 'strava' ? 'strava' : 'manual_workouts',
    };
  }

  private mapDistanceName(distanceKm: number): string {
    const known: Array<{ name: (typeof ATHLETE_GOAL_DISTANCES)[number]; km: number }> = [
      { name: '5k', km: 5 },
      { name: '10k', km: 10 },
      { name: 'half_marathon', km: 21.0975 },
      { name: 'marathon', km: 42.195 },
    ];

    const match = known.find((entry) => Math.abs(entry.km - distanceKm) / entry.km <= 0.02);
    return match?.name ?? 'custom';
  }

  private resolveOverallSource(current: CurrentMetrics): PlanMetricsSource {
    const sources = [
      current.thresholdPaceSecondsPerKm.source,
      current.thresholdHeartRate.source,
      current.weeklyMileageKm.source,
      current.longestRunKm.source,
      current.recentResult.source,
    ];
    if (sources.includes('strava')) {
      return 'strava';
    }
    if (sources.includes('manual_workouts')) {
      return 'manual_workouts';
    }
    if (sources.includes('athlete_state')) {
      return 'athlete_state';
    }
    return 'none';
  }
}
