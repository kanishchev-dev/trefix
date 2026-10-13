import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';

import type { WorkoutView } from '../interfaces/training-views.interface';
import type { RelativeWeek, RelativeWorkout, TrainingEngine } from '../training.engine';

/** Edit of an existing workout of a relative week, addressed by key. */
export interface RelativeWorkoutOverride {
  key: string;
  type?: string;
  dayOfWeek?: number;
  distanceKm?: number;
  durationMinutes?: number;
}

/** New workout appended to a relative week. */
export interface RelativeNewWorkout {
  type: string;
  dayOfWeek: number;
  durationMinutes: number;
  distanceKm?: number;
}

/** Changes of one relative week: removals, edits and additions. */
export interface RelativeWeekOverride {
  weekNumber: number;
  workoutOverrides?: RelativeWorkoutOverride[];
  removedWorkoutKeys?: string[];
  newWorkouts?: RelativeNewWorkout[];
}

export interface ApplyOverridesOptions {
  /** Error code raised for unknown weeks/keys and engine-rejected values. */
  errorCode: string;
  /** Threshold pace used to rebuild targets; recovered from the target when absent. */
  thresholdPaceSecondsPerKm?: number | null;
}

/**
 * Applies user edits to a relative plan structure. Every merged workout is
 * validated by the engine, and a changed type or volume rebuilds target and
 * steps so pace zones stay consistent with the session. Unknown weeks or
 * keys are rejected instead of being silently skipped, because a stale client
 * would otherwise save a plan different from what the user saw.
 */
export function applyRelativeOverrides(
  engine: TrainingEngine,
  source: RelativeWeek[],
  overrides: RelativeWeekOverride[],
  options: ApplyOverridesOptions,
): RelativeWeek[] {
  const weeks = JSON.parse(JSON.stringify(source)) as RelativeWeek[];
  const invalid = (message: string): DomainBadRequestException =>
    new DomainBadRequestException(options.errorCode, message);

  for (const override of overrides) {
    const week = weeks.find((entry) => entry.weekNumber === override.weekNumber);
    if (!week) {
      throw invalid(`Week ${override.weekNumber} does not exist`);
    }

    for (const key of override.removedWorkoutKeys ?? []) {
      const index = week.workouts.findIndex((workout) => workout.key === key);
      if (index < 0) {
        throw invalid(`Workout ${key} not found`);
      }
      week.workouts.splice(index, 1);
    }

    for (const change of override.workoutOverrides ?? []) {
      const workout = week.workouts.find((entry) => entry.key === change.key);
      if (!workout) {
        throw invalid(`Workout ${change.key} not found`);
      }

      const validation = engine.validateWorkoutOverride({
        type: change.type ?? workout.type,
        dayOfWeek: change.dayOfWeek ?? workout.dayOfWeek,
        ...(change.distanceKm !== undefined ? { distanceKm: change.distanceKm } : {}),
        durationMinutes: change.durationMinutes ?? workout.durationMinutes,
      });
      if (!validation.valid) {
        throw invalid(validation.reason);
      }

      const previousType = workout.type;
      const typeChanged = change.type !== undefined && change.type !== workout.type;
      const volumeChanged = change.distanceKm !== undefined || change.durationMinutes !== undefined;

      workout.type = validation.value.type;
      workout.dayOfWeek = change.dayOfWeek ?? workout.dayOfWeek;
      workout.durationMinutes = change.durationMinutes ?? workout.durationMinutes;
      workout.distanceKm = change.distanceKm ?? workout.distanceKm;

      if (typeChanged || volumeChanged) {
        const rebuilt = engine.rebuildWorkoutTarget({
          type: workout.type,
          durationMinutes: workout.durationMinutes,
          previousType,
          previousTarget: workout.target,
          thresholdPaceSecondsPerKm: options.thresholdPaceSecondsPerKm,
        });
        workout.target = rebuilt.target;
        workout.steps = rebuilt.steps;
      }
    }

    let maxOrder = week.workouts.reduce((max, workout) => Math.max(max, workout.orderInWeek), 0);
    for (const addition of override.newWorkouts ?? []) {
      const validation = engine.validateWorkoutOverride({
        type: addition.type,
        dayOfWeek: addition.dayOfWeek,
        ...(addition.distanceKm !== undefined ? { distanceKm: addition.distanceKm } : {}),
        durationMinutes: addition.durationMinutes,
      });
      if (!validation.valid) {
        throw invalid(validation.reason);
      }

      maxOrder += 1;
      const type = validation.value.type as WorkoutView['type'];
      const reference = week.workouts.find((workout) => workout.target && Object.keys(workout.target).length > 0);
      const rebuilt = engine.rebuildWorkoutTarget({
        type,
        durationMinutes: addition.durationMinutes,
        previousType: reference?.type ?? null,
        previousTarget: reference?.target ?? null,
        thresholdPaceSecondsPerKm: options.thresholdPaceSecondsPerKm,
      });
      const created: RelativeWorkout = {
        key: `w${week.weekNumber}-${maxOrder}`,
        dayOfWeek: addition.dayOfWeek,
        orderInWeek: maxOrder,
        type,
        phase: week.phase,
        durationMinutes: addition.durationMinutes,
        distanceKm: addition.distanceKm ?? 0,
        target: rebuilt.target,
        steps: rebuilt.steps,
      };
      week.workouts.push(created);
    }

    week.workouts.sort((left, right) =>
      left.dayOfWeek === right.dayOfWeek ? left.orderInWeek - right.orderInWeek : left.dayOfWeek - right.dayOfWeek,
    );
  }

  return weeks;
}

/** Narrows raw JSONB weeks of a draft into the relative structure. */
export function asRelativeWeeks(weeks: Array<Record<string, unknown>> | null | undefined): RelativeWeek[] {
  return (weeks ?? []) as unknown as RelativeWeek[];
}

/** Whether stored weeks use the relative (draft) format with embedded workouts. */
export function hasRelativeWorkouts(weeks: Array<Record<string, unknown>> | null | undefined): boolean {
  return Array.isArray(weeks) && weeks.every((week) => Array.isArray(week.workouts));
}

/** Average distance of the first two weeks, the fallback volume baseline. */
export function averageFirstWeeksVolume(weeks: RelativeWeek[]): number | null {
  const firstWeeks = [...weeks].sort((left, right) => left.weekNumber - right.weekNumber).slice(0, 2);
  if (firstWeeks.length === 0) {
    return null;
  }
  const total = firstWeeks.reduce(
    (sum, week) => sum + week.workouts.reduce((weekSum, workout) => weekSum + workout.distanceKm, 0),
    0,
  );
  const average = total / firstWeeks.length;
  return average > 0 ? Math.round(average * 10) / 10 : null;
}

/** Dated preview of a relative plan in the manual preview format. */
export interface DatedPreview {
  startDate: string;
  endDate: string;
  totalWeeks: number;
  weeks: Array<{
    weekNumber: number;
    phase: string;
    plannedWorkoutsCount: number;
    plannedDistance: number;
    plannedLoad: number;
    workouts: Array<{
      id: string;
      type: string;
      phase: string;
      weekNumber: number;
      dayOfWeek: number;
      scheduledAt: string;
      orderInWeek: number;
      durationMinutes: number;
      distanceKm: number;
      target: Record<string, unknown>;
      steps: Array<Record<string, unknown>>;
    }>;
  }>;
}

/**
 * Lays a relative plan out on the calendar from `startDate` so the client can
 * reuse the regular preview screen. Workout ids are the stable relative keys.
 */
export function relativeToPreview(engine: TrainingEngine, weeks: RelativeWeek[], startDate: string): DatedPreview {
  const materialized = engine.materializeWeeks(weeks, new Date(`${startDate}T00:00:00Z`));
  return {
    startDate: materialized.startDate,
    endDate: materialized.endDate,
    totalWeeks: materialized.totalWeeks,
    weeks: weeks.map((week) => {
      const workouts = materialized.workouts.filter((workout) => workout.weekNumber === week.weekNumber);
      return {
        weekNumber: week.weekNumber,
        phase: week.phase.toUpperCase(),
        plannedWorkoutsCount: workouts.length,
        plannedDistance: Math.round(workouts.reduce((sum, workout) => sum + workout.distanceKm, 0)),
        plannedLoad: Math.round(Number(week.weeklyLoadTarget ?? 0)),
        workouts: workouts.map((workout) => ({
          id: workout.key,
          type: workout.type,
          phase: workout.phase,
          weekNumber: workout.weekNumber,
          dayOfWeek: (workout.scheduledAt.getUTCDay() + 6) % 7,
          scheduledAt: workout.scheduledAt.toISOString().slice(0, 10),
          orderInWeek: workout.orderInWeek,
          durationMinutes: workout.durationMinutes,
          distanceKm: workout.distanceKm,
          target: workout.target,
          steps: workout.steps,
        })),
      };
    }),
  };
}
