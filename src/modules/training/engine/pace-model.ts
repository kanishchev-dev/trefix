import { AthleteView, GoalView, WorkoutView } from '../interfaces/training-views.interface';
import { ATHLETE_GOAL_DISTANCES } from '../training.constants';
import { AthleteMetrics } from './engine.types';
import { clamp, resolveDistanceKilometres } from './engine-utils';

/*
 * Pace and heart-rate model: threshold estimates and the pace ranges derived from them.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

/**
 * Derives the threshold pace directly from the universal goal payload
 * (target finish time over a distance, or an explicit target pace).
 */
function resolveUniversalGoalPace(goal: GoalView | null): number | null {
  const target = goal?.payload?.target;
  if (!target) {
    return null;
  }

  const finishTimeSec = typeof target.finishTimeSec === 'number' ? target.finishTimeSec : 0;
  const distanceMeters = typeof target.distanceMeters === 'number' ? target.distanceMeters : 0;
  if (finishTimeSec > 0 && distanceMeters > 0) {
    return Math.round(finishTimeSec / (distanceMeters / 1000));
  }

  const paceSecondsPerKm = target.paceSecondsPerKm;
  if (typeof paceSecondsPerKm === 'number' && paceSecondsPerKm > 0) {
    return paceSecondsPerKm;
  }

  return null;
}

export function resolvePaceRange(
  workoutType: WorkoutView['type'],
  thresholdPaceSecondsPerKm: number | null,
): { min: number; max: number; zone: string } {
  const threshold = thresholdPaceSecondsPerKm ?? 360;

  switch (workoutType) {
    case 'recovery':
      return { min: Math.round(threshold * 1.2), max: Math.round(threshold * 1.3), zone: 'Z1' };
    case 'easy':
      return { min: Math.round(threshold * 1.1), max: Math.round(threshold * 1.2), zone: 'Z2' };
    case 'long_run':
      return { min: Math.round(threshold * 1.12), max: Math.round(threshold * 1.22), zone: 'Z2' };
    case 'tempo':
      return { min: Math.round(threshold * 0.98), max: Math.round(threshold * 1.03), zone: 'Z3' };
    case 'threshold':
      return { min: Math.round(threshold * 0.95), max: Math.round(threshold * 1.0), zone: 'Z4' };
    case 'interval':
    case 'hill':
      return { min: Math.round(threshold * 0.88), max: Math.round(threshold * 0.95), zone: 'Z5' };
    case 'race':
      return { min: Math.round(threshold * 0.9), max: Math.round(threshold * 0.97), zone: 'Z5' };
    case 'rest':
    default:
      return { min: 0, max: 0, zone: 'rest' };
  }
}

export function resolveTargetPace(workout: WorkoutView): number | null {
  const paceMin = workout.target.paceMinSecondsPerKm;
  const paceMax = workout.target.paceMaxSecondsPerKm;
  if (typeof paceMin === 'number' && typeof paceMax === 'number' && paceMin > 0 && paceMax > 0) {
    return Math.round((paceMin + paceMax) / 2);
  }

  return null;
}

export function resolveActualPace(durationMinutes: number, distanceKm: number): number | null {
  if (distanceKm <= 0) {
    return null;
  }

  return Math.round((durationMinutes * 60) / distanceKm);
}

export function resolveThresholdPace(athlete: AthleteView, goal: GoalView | null): number | null {
  // Universal payload takes priority: the engine distinguishes goal types
  // instead of treating every goal as a generic race target.
  const universalPace = resolveUniversalGoalPace(goal);
  if (universalPace) {
    return universalPace;
  }

  // Legacy race columns stay supported for goals created before the
  // universal model.
  if (
    goal?.targetTimeSeconds &&
    ATHLETE_GOAL_DISTANCES.includes(goal.raceDistance as (typeof ATHLETE_GOAL_DISTANCES)[number])
  ) {
    const distanceKm = resolveDistanceKilometres(goal.raceDistance);
    if (distanceKm > 0) {
      return Math.round(goal.targetTimeSeconds / distanceKm);
    }
  }

  const bestResult = athlete.recentRaceResults[0];
  const pace = bestResult && typeof bestResult.paceSecondsPerKm === 'number' ? bestResult.paceSecondsPerKm : null;
  if (pace) {
    return pace;
  }

  if (athlete.weeklyMileageKm) {
    return Math.round(420 - Math.min(120, athlete.weeklyMileageKm * 1.2));
  }

  return null;
}

export function resolveThresholdHeartRate(athlete: AthleteView, goal: GoalView | null): number | null {
  const bestResult = athlete.recentRaceResults[0];
  if (bestResult && typeof bestResult.thresholdHeartRate === 'number') {
    return bestResult.thresholdHeartRate;
  }

  if (goal?.targetTimeSeconds) {
    return 165;
  }

  return null;
}

export function estimateVo2maxFromThresholdPace(thresholdPaceSecondsPerKm: number): number {
  return clamp(Math.round(80 - thresholdPaceSecondsPerKm / 10), 35, 70);
}

export function resolveGoalPace(goal: GoalView, athlete: AthleteView): number {
  const thresholdPace = resolveThresholdPace(athlete, goal);
  return thresholdPace ?? 360;
}

/** Recovers the threshold pace a target was built from, if possible. */
export function estimateThresholdFromTarget(
  type: WorkoutView['type'],
  target: Record<string, unknown> | null,
): number | null {
  const paceMin = target?.paceMinSecondsPerKm;
  if (typeof paceMin !== 'number' || paceMin <= 0) {
    return null;
  }
  const reference = resolvePaceRange(type, 1000).min;
  return reference > 0 ? Math.round((paceMin * 1000) / reference) : null;
}

/** Resolves the threshold pace used by retargetIntensity. */
export function resolveThresholdFromMetrics(metrics: AthleteMetrics): number | null {
  const explicit = metrics.thresholdPaceSecondsPerKm;
  if (typeof explicit === 'number' && explicit > 0) {
    return Math.round(explicit);
  }

  const result = metrics.recentResult;
  if (result && typeof result.timeSeconds === 'number' && result.timeSeconds > 0) {
    const distanceKm = resolveDistanceKilometres(result.distance);
    if (distanceKm > 0) {
      return Math.round(result.timeSeconds / distanceKm);
    }
  }

  return null;
}

/** Exposes the pace-range resolution so services reuse the same zones. */
export function resolvePaceRangeFor(
  workoutType: WorkoutView['type'],
  thresholdPaceSecondsPerKm: number | null,
): { min: number; max: number; zone: string } {
  return resolvePaceRange(workoutType, thresholdPaceSecondsPerKm);
}
