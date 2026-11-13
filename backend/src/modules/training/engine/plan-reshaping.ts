import { REBUILD_VOLUME_SCALE_MAX, REBUILD_VOLUME_SCALE_MIN } from '../training.constants';
import {
  AthleteMetrics,
  PlanDiffAdjustment,
  PlanResizeNotPossibleError,
  RelativeWeek,
  RelativeWorkout,
} from './engine.types';
import { clamp, renumberWeeks } from './engine-utils';
import { resolvePaceRange, resolveThresholdFromMetrics } from './pace-model';
import { validateWorkoutOverride } from './workout-prescription';

/*
 * Reshaping a relative plan: intensity retargeting, volume scaling, resizing to a new end date.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

/**
 * Re-targets workout intensities to a new threshold pace.
 * Threshold resolution: explicit value → best recent result → caller-provided
 * athlete state values. `rest` workouts stay untouched.
 */
export function retargetIntensity(weeks: RelativeWeek[], metrics: AthleteMetrics): RelativeWeek[] {
  const threshold = resolveThresholdFromMetrics(metrics);
  if (!threshold) {
    return weeks;
  }

  return weeks.map((week) => ({
    ...week,
    workouts: week.workouts.map((workout) => {
      if (workout.type === 'rest') {
        return workout;
      }

      const paceRange = resolvePaceRange(workout.type, threshold);
      const target: Record<string, unknown> = {
        ...workout.target,
        paceMinSecondsPerKm: paceRange.min,
        paceMaxSecondsPerKm: paceRange.max,
        zone: paceRange.zone,
      };

      const thresholdHeartRate = metrics.thresholdHeartRate;
      if (
        typeof thresholdHeartRate === 'number' &&
        (target.heartRateMinBpm !== undefined || target.heartRateMaxBpm !== undefined)
      ) {
        // Heart rate grows as pace gets faster: the slow edge of the pace
        // range maps to the low edge of the heart-rate range.
        target.heartRateMinBpm = Math.round(thresholdHeartRate * (threshold / paceRange.max));
        target.heartRateMaxBpm = Math.round(thresholdHeartRate * (threshold / paceRange.min));
      }

      const steps = workout.steps.map((step) => {
        const stepTarget = step.target;
        if (!stepTarget || typeof stepTarget !== 'object') {
          return step;
        }
        return {
          ...step,
          target: {
            ...(stepTarget as Record<string, unknown>),
            paceMinSecondsPerKm: paceRange.min,
            paceMaxSecondsPerKm: paceRange.max,
            zone: paceRange.zone,
          },
        };
      });

      return { ...workout, target, steps };
    }),
  }));
}

/**
 * Scales distances/durations by `k` with per-type rules and safety caps
 *. Returns the applied adjustments for the plan diff.
 */
export function scaleVolume(
  weeks: RelativeWeek[],
  k: number,
  metrics: AthleteMetrics,
): { weeks: RelativeWeek[]; adjustments: PlanDiffAdjustment[] } {
  const clamped = Number(clamp(k, REBUILD_VOLUME_SCALE_MIN, REBUILD_VOLUME_SCALE_MAX).toFixed(3));
  const adjustments: PlanDiffAdjustment[] = [{ code: 'VOLUME_SCALED', params: { k: clamped } }];
  const longestRunCapKm =
    metrics.longestRunKm && metrics.longestRunKm > 0
      ? Math.max(metrics.longestRunKm * 1.15, metrics.longestRunKm + 3)
      : null;

  const scaled = weeks.map((week) => ({
    ...week,
    workouts: week.workouts.map((workout) => scaleWorkoutVolume(workout, clamped)),
  }));

  if (longestRunCapKm !== null) {
    for (const week of scaled) {
      for (const workout of week.workouts) {
        if (workout.type === 'long_run' && workout.distanceKm > longestRunCapKm) {
          workout.distanceKm = Math.round(longestRunCapKm * 10) / 10;
          adjustments.push({ code: 'LONG_RUN_CAPPED', params: { week: week.weekNumber, km: workout.distanceKm } });
        }
      }
    }
  }

  capEarlyWeeklyGrowth(scaled, adjustments);

  return { weeks: scaled, adjustments };
}

/**
 * Extends or shortens the plan to `newTotalWeeks`. Weeks before
 * `currentWeek` are never touched; taper and race weeks survive a
 * reduction. Extension inserts copies of the last non-taper week right
 * before the taper with volume progression of at most 5 % per week.
 * Existing workout keys stay stable; inserted copies get derived keys.
 */
export function resizeToTargetDate(weeks: RelativeWeek[], currentWeek: number, newTotalWeeks: number): RelativeWeek[] {
  const currentTotal = weeks.length;
  const passedWeeks = Math.max(0, currentWeek - 1);
  const protectedTail = countTrailingTaperWeeks(weeks);

  if (newTotalWeeks === currentTotal) {
    return weeks;
  }

  if (newTotalWeeks > currentTotal) {
    const insertCount = newTotalWeeks - currentTotal;
    const templateIndex = findExtensionTemplateIndex(weeks, passedWeeks);
    if (templateIndex === null) {
      throw new PlanResizeNotPossibleError();
    }

    const template = weeks[templateIndex];
    const inserted: RelativeWeek[] = [];
    for (let index = 0; index < insertCount; index += 1) {
      const progression = Math.pow(1.05, index + 1);
      inserted.push({
        ...template,
        workouts: template.workouts.map((workout) => ({
          ...workout,
          key: `${workout.key}~x${index + 1}`,
          distanceKm: Math.round(workout.distanceKm * progression * 10) / 10,
        })),
      });
    }

    return renumberWeeks([...weeks.slice(0, templateIndex + 1), ...inserted, ...weeks.slice(templateIndex + 1)]);
  }

  const removableCount = currentTotal - newTotalWeeks;
  const removable = weeks.filter(
    (week) => week.weekNumber > passedWeeks && week.weekNumber <= currentTotal - protectedTail,
  );
  const remainingNonTaper = newTotalWeeks - protectedTail;
  if (removable.length < removableCount || remainingNonTaper < 2) {
    throw new PlanResizeNotPossibleError();
  }

  // Remove from the end of the base/build remainder first.
  const removedWeekNumbers = new Set(removable.slice(-removableCount).map((week) => week.weekNumber));
  return renumberWeeks(weeks.filter((week) => !removedWeekNumbers.has(week.weekNumber)));
}

function scaleWorkoutVolume(workout: RelativeWorkout, k: number): RelativeWorkout {
  if (workout.type === 'race' || workout.type === 'rest') {
    return workout;
  }

  if (workout.type === 'interval') {
    // Only warm-up and cool-down absorb the scale; work repeats stay intact.
    return {
      ...workout,
      steps: workout.steps.map((step) =>
        ['warmup', 'cooldown'].includes(String(step.type))
          ? { ...step, durationMinutes: Math.round(Number(step.durationMinutes ?? 0) * k) }
          : step,
      ),
    };
  }

  const distanceKm = Math.round(workout.distanceKm * k * 10) / 10;
  const durationMinutes = Math.round(workout.durationMinutes * k);

  const validation = validateWorkoutOverride({ type: workout.type, distanceKm, durationMinutes });
  if (!validation.valid) {
    return workout;
  }

  return { ...workout, distanceKm, durationMinutes };
}

/** Limits week-over-week growth to 10 % on the first four weeks. */
function capEarlyWeeklyGrowth(weeks: RelativeWeek[], adjustments: PlanDiffAdjustment[]): void {
  const volumes = weeks.map((week) => week.workouts.reduce((sum, workout) => sum + workout.distanceKm, 0));

  for (let index = 1; index < Math.min(weeks.length, 4); index += 1) {
    const previous = volumes[index - 1];
    const current = volumes[index];
    if (previous <= 0 || current <= previous * 1.1) {
      continue;
    }

    const factor = (previous * 1.1) / current;
    for (const workout of weeks[index].workouts) {
      if (workout.type === 'race' || workout.type === 'rest') {
        continue;
      }
      workout.distanceKm = Math.round(workout.distanceKm * factor * 10) / 10;
      if (workout.type !== 'interval') {
        workout.durationMinutes = Math.max(1, Math.round(workout.durationMinutes * factor));
      }
    }
    volumes[index] = weeks[index].workouts.reduce((sum, workout) => sum + workout.distanceKm, 0);
    adjustments.push({
      code: 'WEEKLY_GROWTH_CAPPED',
      params: { week: weeks[index].weekNumber, km: Math.round(volumes[index] * 10) / 10 },
    });
  }
}

function countTrailingTaperWeeks(weeks: RelativeWeek[]): number {
  let count = 0;
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    if (['taper', 'race'].includes(weeks[index].phase)) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

/** Last build/specific (or base) week usable as an extension template. */
function findExtensionTemplateIndex(weeks: RelativeWeek[], passedWeeks: number): number | null {
  for (let index = weeks.length - 1; index >= passedWeeks; index -= 1) {
    if (!['taper', 'race'].includes(weeks[index].phase)) {
      return index;
    }
  }
  return null;
}
