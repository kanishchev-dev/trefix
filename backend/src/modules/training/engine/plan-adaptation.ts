import { WorkoutAnalysisView, WorkoutView } from '../interfaces/training-views.interface';
import { AdaptationResult, TrainingStateComputation } from './engine.types';
import { addDays, clamp, formatDate, isHardWorkout, isQualityWorkout } from './engine-utils';

/*
 * Adaptation decisions: how upcoming workouts change after a completed one.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

export function adaptPlan(
  planWeeks: Array<Record<string, unknown>>,
  workouts: WorkoutView[],
  state: TrainingStateComputation,
  analysis: WorkoutAnalysisView,
  forcedAction?: string,
): AdaptationResult {
  const action = forcedAction || resolveAdaptationAction(state, analysis);
  const changes: Array<Record<string, unknown>> = [];

  if (action === 'REDUCE_INTENSITY' || action === 'ADD_RECOVERY') {
    const nextHardWorkout = workouts.find((workout) => workout.status === 'planned' && isHardWorkout(workout.type));
    if (nextHardWorkout) {
      changes.push(transformWorkoutToRecovery(nextHardWorkout));
    }
  }

  if (action === 'REDUCE_VOLUME') {
    changes.push(...reduceUpcomingLoad(workouts, 0.8));
  }

  if (action === 'INCREASE_VOLUME') {
    changes.push(...increaseUpcomingLoad(workouts, 1.1));
  }

  if (action === 'INCREASE_INTENSITY') {
    const nextQualityWorkout = workouts.find(
      (workout) => workout.status === 'planned' && isQualityWorkout(workout.type),
    );
    if (nextQualityWorkout) {
      changes.push(intensifyWorkout(nextQualityWorkout));
    }
  }

  if (action === 'MOVE') {
    const nextWorkout = workouts.find((workout) => workout.status === 'planned');
    if (nextWorkout) {
      changes.push({
        workoutId: nextWorkout.id,
        scheduledAt: moveToNextAvailableDay(nextWorkout.scheduledAt, workouts),
      });
    }
  }

  if (action === 'REPLACE') {
    const nextWorkout = workouts.find((workout) => workout.status === 'planned');
    if (nextWorkout) {
      changes.push(transformWorkoutToRecovery(nextWorkout));
    }
  }

  if (action === 'REGENERATE_PLAN') {
    changes.push({
      regeneratePlan: true,
      weeks: planWeeks.length,
    });
  }

  if (action === 'KEEP') {
    changes.push({
      noChanges: true,
    });
  }

  return {
    action,
    reason: resolveAdaptationReason(action, state, analysis),
    confidence: resolveAdaptationConfidence(state, analysis),
    changes,
  };
}

function resolveAdaptationAction(state: TrainingStateComputation, analysis: WorkoutAnalysisView): string {
  if (analysis.completion < 0.75 || analysis.performanceDelta < -0.1) {
    return 'REDUCE_INTENSITY';
  }

  if (state.recoveryScore < 35 || state.fatigue > state.fitness * 1.2) {
    return 'ADD_RECOVERY';
  }

  if (analysis.completion > 1.05 && analysis.performanceDelta > 0.08 && state.recoveryScore >= 65) {
    return 'INCREASE_VOLUME';
  }

  if (analysis.performanceDelta > 0.12) {
    return 'INCREASE_INTENSITY';
  }

  return 'KEEP';
}

function resolveAdaptationReason(
  action: string,
  state: TrainingStateComputation,
  analysis: WorkoutAnalysisView,
): string {
  if (action === 'REDUCE_INTENSITY') {
    return analysis.performanceDelta < -0.1 ? 'poor_performance' : 'high_fatigue';
  }
  if (action === 'ADD_RECOVERY') {
    return 'low_recovery';
  }
  if (action === 'INCREASE_VOLUME') {
    return 'excellent_performance';
  }
  if (action === 'INCREASE_INTENSITY') {
    return 'strong_adaptation';
  }
  if (action === 'REPLACE') {
    return 'workout_replacement';
  }
  return state.recoveryScore >= 65 ? 'stable_load' : 'conservative_progression';
}

function resolveAdaptationConfidence(state: TrainingStateComputation, analysis: WorkoutAnalysisView): number {
  const base = 0.65 + analysis.completion * 0.1 + Math.abs(analysis.performanceDelta) * 0.1;
  return clamp(base + (state.confidence - 0.5) * 0.3, 0, 1);
}

function transformWorkoutToRecovery(workout: WorkoutView): Record<string, unknown> {
  return {
    workoutId: workout.id,
    type: 'recovery',
    durationMinutes: Math.max(20, Math.round(workout.durationMinutes * 0.7)),
    distanceKm: Math.round(workout.distanceKm * 0.75 * 10) / 10,
  };
}

function reduceUpcomingLoad(workouts: WorkoutView[], multiplier: number): Array<Record<string, unknown>> {
  return workouts
    .filter((workout) => workout.status === 'planned')
    .slice(0, 3)
    .map((workout) => ({
      workoutId: workout.id,
      durationMinutes: Math.max(20, Math.round(workout.durationMinutes * multiplier)),
      distanceKm: Math.round(workout.distanceKm * multiplier * 10) / 10,
    }));
}

function increaseUpcomingLoad(workouts: WorkoutView[], multiplier: number): Array<Record<string, unknown>> {
  return workouts
    .filter((workout) => workout.status === 'planned')
    .slice(0, 2)
    .map((workout) => ({
      workoutId: workout.id,
      durationMinutes: Math.round(workout.durationMinutes * multiplier),
      distanceKm: Math.round(workout.distanceKm * multiplier * 10) / 10,
    }));
}

function intensifyWorkout(workout: WorkoutView): Record<string, unknown> {
  const nextType = workout.type === 'tempo' ? 'threshold' : workout.type === 'threshold' ? 'interval' : 'tempo';
  return {
    workoutId: workout.id,
    type: nextType,
    durationMinutes: workout.durationMinutes,
  };
}

function moveToNextAvailableDay(scheduledAt: Date, workouts: WorkoutView[]): string {
  const takenDays = new Set(workouts.map((workout) => formatDate(workout.scheduledAt)));
  let nextDate = new Date(scheduledAt);

  for (let index = 0; index < 7; index += 1) {
    nextDate = addDays(nextDate, 1);
    const candidate = formatDate(nextDate);
    if (!takenDays.has(candidate)) {
      return candidate;
    }
  }

  return formatDate(addDays(scheduledAt, 1));
}
