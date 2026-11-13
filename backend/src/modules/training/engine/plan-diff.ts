import {
  AthleteMetrics,
  PlanDiff,
  PlanDiffAdjustment,
  PlanDiffWeek,
  PlanDiffWorkout,
  RelativeWeek,
  RelativeWorkout,
} from './engine.types';
import { estimateThresholdFromTarget } from './pace-model';

/*
 * Field-level difference between two versions of a plan.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

/**
 * Week- and workout-level diff between two relative plans. Workouts are
 * matched by key across weeks, so a session moved to another week or day
 * shows up as one `modified` entry (with `weekNumber` / `dayOfWeek`
 * fields) instead of a remove/add pair.
 */
export function diffPlans(
  before: RelativeWeek[],
  after: RelativeWeek[],
  metricsBefore?: AthleteMetrics | null,
  metricsAfter?: AthleteMetrics | null,
  adjustments: PlanDiffAdjustment[] = [],
): PlanDiff {
  const volumeOf = (weeks: RelativeWeek[]): number[] =>
    [...weeks]
      .sort((left, right) => left.weekNumber - right.weekNumber)
      .map((week) => Math.round(week.workouts.reduce((sum, workout) => sum + workout.distanceKm, 0) * 10) / 10);
  const longestRun = (weeks: RelativeWeek[]): number | null => {
    const runs = weeks.flatMap((week) => week.workouts.filter((workout) => workout.type === 'long_run'));
    return runs.length > 0 ? Math.round(Math.max(...runs.map((workout) => workout.distanceKm)) * 10) / 10 : null;
  };
  const thresholdOf = (metrics: AthleteMetrics | null | undefined, weeks: RelativeWeek[]): number | null => {
    if (metrics?.thresholdPaceSecondsPerKm) {
      return metrics.thresholdPaceSecondsPerKm;
    }
    for (const week of weeks) {
      for (const workout of week.workouts) {
        const estimate = estimateThresholdFromTarget(workout.type, workout.target);
        if (estimate) {
          return estimate;
        }
      }
    }
    return null;
  };

  const index = (weeks: RelativeWeek[]): Map<string, { weekNumber: number; workout: RelativeWorkout }> => {
    const map = new Map<string, { weekNumber: number; workout: RelativeWorkout }>();
    for (const week of weeks) {
      for (const workout of week.workouts) {
        map.set(workout.key, { weekNumber: week.weekNumber, workout });
      }
    }
    return map;
  };

  const beforeIndex = index(before);
  const afterIndex = index(after);
  const beforeWeeks = new Map(before.map((week) => [week.weekNumber, week]));
  const afterWeeks = new Map(after.map((week) => [week.weekNumber, week]));
  const diffsByWeek = new Map<number, PlanDiffWorkout[]>();
  const push = (weekNumber: number, entry: PlanDiffWorkout): void => {
    diffsByWeek.set(weekNumber, [...(diffsByWeek.get(weekNumber) ?? []), entry]);
  };

  for (const [key, entry] of afterIndex) {
    const previous = beforeIndex.get(key);
    if (!previous) {
      push(entry.weekNumber, { key, change: 'added' });
      continue;
    }
    const fields = diffWorkoutFields(previous.workout, entry.workout);
    if (previous.weekNumber !== entry.weekNumber) {
      fields.weekNumber = [previous.weekNumber, entry.weekNumber];
    }
    if (Object.keys(fields).length > 0) {
      push(entry.weekNumber, { key, change: 'modified', fields });
    }
  }
  for (const [key, entry] of beforeIndex) {
    if (!afterIndex.has(key)) {
      push(entry.weekNumber, { key, change: 'removed' });
    }
  }

  const weekNumbers = [...new Set([...beforeWeeks.keys(), ...afterWeeks.keys()])].sort((a, b) => a - b);
  const weeks: PlanDiffWeek[] = [];
  for (const weekNumber of weekNumbers) {
    const beforeWeek = beforeWeeks.get(weekNumber);
    const afterWeek = afterWeeks.get(weekNumber);
    const workouts = diffsByWeek.get(weekNumber) ?? [];

    if (beforeWeek && !afterWeek) {
      weeks.push({ weekNumber, change: 'removed', workouts });
      continue;
    }
    if (!beforeWeek && afterWeek) {
      weeks.push({ weekNumber, change: 'added', workouts });
      continue;
    }
    const metadataChanged =
      !!beforeWeek &&
      !!afterWeek &&
      (beforeWeek.phase !== afterWeek.phase ||
        Number(beforeWeek.weeklyLoadTarget ?? 0) !== Number(afterWeek.weeklyLoadTarget ?? 0));
    if (workouts.length > 0 || metadataChanged) {
      weeks.push({ weekNumber, change: 'modified', workouts });
    }
  }

  const beforeVolume = volumeOf(before);
  const afterVolume = volumeOf(after);
  return {
    summary: {
      weeklyVolumeKm: { before: beforeVolume, after: afterVolume },
      peakWeekKm: { before: Math.max(0, ...beforeVolume), after: Math.max(0, ...afterVolume) },
      longestRunKm: { before: longestRun(before), after: longestRun(after) },
      thresholdPace: { before: thresholdOf(metricsBefore, before), after: thresholdOf(metricsAfter, after) },
      totalWeeks: { before: before.length, after: after.length },
      adjustments,
    },
    weeks,
  };
}

function diffWorkoutFields(before: RelativeWorkout, after: RelativeWorkout): Record<string, [unknown, unknown]> {
  const fields: Record<string, [unknown, unknown]> = {};
  const compare = (path: string, left: unknown, right: unknown): void => {
    if (left !== right) {
      fields[path] = [left, right];
    }
  };

  compare('type', before.type, after.type);
  compare('dayOfWeek', before.dayOfWeek, after.dayOfWeek);
  compare('durationMinutes', before.durationMinutes, after.durationMinutes);
  compare('distanceKm', before.distanceKm, after.distanceKm);
  compare('target.paceMinSecondsPerKm', before.target.paceMinSecondsPerKm, after.target.paceMinSecondsPerKm);
  compare('target.paceMaxSecondsPerKm', before.target.paceMaxSecondsPerKm, after.target.paceMaxSecondsPerKm);

  return fields;
}
