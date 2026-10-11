import { AthleteView, GoalView, WorkoutView } from '../interfaces/training-views.interface';
import {
  MANUAL_PLAN_MAX_DISTANCE_KM,
  MANUAL_PLAN_MAX_DURATION_MINUTES,
  MANUAL_PLAN_MIN_DURATION_MINUTES,
  TRAINING_DEFAULT_DURATION_MINUTES,
  WORKOUT_TYPE_INTENSITY_FACTORS,
} from '../training.constants';
import { TrainingStateComputation, WorkoutBuildResult } from './engine.types';
import { estimateThresholdFromTarget, resolveGoalPace, resolvePaceRange } from './pace-model';

/*
 * Single-workout prescription: duration, distance, targets and steps.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

export function createWorkoutBlueprint(input: {
  athlete: AthleteView;
  goal: GoalView;
  state: TrainingStateComputation;
  phase: string;
  weekNumber: number;
  workoutType: WorkoutView['type'];
  scheduledAt: Date;
  orderInWeek: number;
  weekLoadTarget: number;
}): WorkoutBuildResult {
  return buildWorkout(input);
}

export function buildWorkout(input: {
  athlete: AthleteView;
  goal: GoalView;
  state: TrainingStateComputation;
  phase: string;
  weekNumber: number;
  workoutType: WorkoutView['type'];
  scheduledAt: Date;
  orderInWeek: number;
  weekLoadTarget: number;
}): WorkoutBuildResult {
  const durationMinutes = resolveWorkoutDuration(input.athlete, input.workoutType, input.state);
  const distanceKm = resolveWorkoutDistance(durationMinutes, input.state, input.workoutType);
  const thresholdPace = input.state.thresholdPaceSecondsPerKm ?? resolveGoalPace(input.goal, input.athlete);
  const target = buildWorkoutTarget(input.workoutType, thresholdPace);
  const steps = buildWorkoutSteps(input.workoutType, durationMinutes, target);

  return {
    type: input.workoutType,
    phase: input.phase,
    weekNumber: input.weekNumber,
    scheduledAt: input.scheduledAt,
    orderInWeek: input.orderInWeek,
    durationMinutes,
    distanceKm,
    target,
    steps,
  };
}

function buildWorkoutTarget(
  workoutType: WorkoutView['type'],
  thresholdPaceSecondsPerKm: number | null,
): Record<string, unknown> {
  const paceRange = resolvePaceRange(workoutType, thresholdPaceSecondsPerKm);
  return {
    paceMinSecondsPerKm: paceRange.min,
    paceMaxSecondsPerKm: paceRange.max,
    zone: paceRange.zone,
    workoutType,
  };
}

function buildWorkoutSteps(
  workoutType: WorkoutView['type'],
  durationMinutes: number,
  target: Record<string, unknown>,
): Array<Record<string, unknown>> {
  if (workoutType === 'rest') {
    return [{ type: 'rest', durationMinutes }];
  }

  if (workoutType === 'recovery' || workoutType === 'easy') {
    return [
      { type: 'warmup', durationMinutes: Math.max(8, Math.round(durationMinutes * 0.15)) },
      {
        type: workoutType,
        durationMinutes: Math.max(15, Math.round(durationMinutes * 0.7)),
        target,
      },
      { type: 'cooldown', durationMinutes: Math.max(5, Math.round(durationMinutes * 0.15)) },
    ];
  }

  if (workoutType === 'long_run') {
    return [
      { type: 'warmup', durationMinutes: 10 },
      {
        type: 'long_run',
        durationMinutes: Math.max(25, durationMinutes - 15),
        target,
      },
      { type: 'cooldown', durationMinutes: 5 },
    ];
  }

  return [
    { type: 'warmup', durationMinutes: Math.max(10, Math.round(durationMinutes * 0.18)) },
    {
      type: workoutType,
      durationMinutes: Math.max(18, Math.round(durationMinutes * 0.55)),
      repetitions: resolveRepetitions(workoutType),
      target,
    },
    { type: 'recovery', durationMinutes: Math.max(6, Math.round(durationMinutes * 0.12)) },
    { type: 'cooldown', durationMinutes: Math.max(5, Math.round(durationMinutes * 0.15)) },
  ];
}

function resolveWorkoutDuration(
  athlete: AthleteView,
  workoutType: WorkoutView['type'],
  state: TrainingStateComputation,
): number {
  const base = athlete.preferredWorkoutDurationMinutes || TRAINING_DEFAULT_DURATION_MINUTES;
  const fatiguePenalty = state.recoveryScore < 45 ? 0.8 : state.recoveryScore < 70 ? 0.9 : 1;

  switch (workoutType) {
    case 'long_run':
      return Math.round(Math.max(base * 1.6, base + 20) * fatiguePenalty);
    case 'interval':
    case 'threshold':
    case 'tempo':
    case 'hill':
      return Math.round(base * 1.1 * fatiguePenalty);
    case 'race':
      return Math.round(base * 0.9 * fatiguePenalty);
    case 'recovery':
      return Math.round(base * 0.75 * fatiguePenalty);
    case 'easy':
      return Math.round(base * 0.9 * fatiguePenalty);
    case 'rest':
      return 0;
    default:
      return Math.round(base * fatiguePenalty);
  }
}

function resolveWorkoutDistance(
  durationMinutes: number,
  state: TrainingStateComputation,
  workoutType: WorkoutView['type'],
): number {
  if (durationMinutes === 0) {
    return 0;
  }

  const paceSeconds = state.thresholdPaceSecondsPerKm ?? 360;
  const targetPace = resolvePaceRange(workoutType, paceSeconds).min;
  const distance = (durationMinutes * 60) / targetPace;
  return Math.round(distance * 10) / 10;
}

function resolveRepetitions(workoutType: WorkoutView['type']): number {
  if (workoutType === 'interval') {
    return 5;
  }
  if (workoutType === 'hill') {
    return 8;
  }
  if (workoutType === 'threshold') {
    return 3;
  }
  if (workoutType === 'tempo') {
    return 2;
  }
  return 1;
}

/**
 * Validates a user-provided workout override against the engine constraints.
 * The override carries only changed fields; the caller must merge it with the
 * existing workout before calling.
 */
export function validateWorkoutOverride(input: {
  type: string;
  dayOfWeek?: number;
  distanceKm?: number;
  durationMinutes?: number;
}):
  | {
      valid: true;
      value: { type: WorkoutView['type']; dayOfWeek?: number; distanceKm?: number; durationMinutes?: number };
    }
  | { valid: false; reason: string } {
  if (!(WORKOUT_TYPE_INTENSITY_FACTORS as Record<string, number>)[input.type]) {
    return { valid: false, reason: 'unsupported_workout_type' };
  }

  if (input.dayOfWeek !== undefined && (input.dayOfWeek < 0 || input.dayOfWeek > 6)) {
    return { valid: false, reason: 'invalid_day_of_week' };
  }

  if (input.distanceKm !== undefined && (input.distanceKm <= 0 || input.distanceKm > MANUAL_PLAN_MAX_DISTANCE_KM)) {
    return { valid: false, reason: 'invalid_distance' };
  }

  if (
    input.durationMinutes !== undefined &&
    (input.durationMinutes < MANUAL_PLAN_MIN_DURATION_MINUTES ||
      input.durationMinutes > MANUAL_PLAN_MAX_DURATION_MINUTES)
  ) {
    return { valid: false, reason: 'invalid_duration' };
  }

  return {
    valid: true,
    value: input as { type: WorkoutView['type']; dayOfWeek?: number; distanceKm?: number; durationMinutes?: number },
  };
}

/**
 * Rebuilds target and steps of a workout after its type or volume changed,
 * so pace zones always match the session type. The threshold pace comes
 * from the explicit value, else is recovered from the previous target.
 */
export function rebuildWorkoutTarget(input: {
  type: WorkoutView['type'];
  durationMinutes: number;
  previousType?: WorkoutView['type'] | null;
  previousTarget?: Record<string, unknown> | null;
  thresholdPaceSecondsPerKm?: number | null;
}): { target: Record<string, unknown>; steps: Array<Record<string, unknown>> } {
  const threshold =
    input.thresholdPaceSecondsPerKm ??
    (input.previousType && input.previousTarget
      ? estimateThresholdFromTarget(input.previousType, input.previousTarget)
      : null);
  const target = buildWorkoutTarget(input.type, threshold);
  return { target, steps: buildWorkoutSteps(input.type, input.durationMinutes, target) };
}
