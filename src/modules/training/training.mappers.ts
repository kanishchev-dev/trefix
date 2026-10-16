import { AdaptationEvent } from './entities/adaptation-event.entity';
import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { AthleteState } from './entities/athlete-state.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';
import {
  AdaptationEventView,
  AthleteStateView,
  AthleteView,
  GoalView,
  TrainingPlanView,
  WorkoutAnalysisView,
  WorkoutView,
} from './interfaces/training-views.interface';
import { TRAINING_DEFAULT_AVAILABILITY } from './training.constants';
import { type TrainingStateComputation } from './training.engine';

/*
 * Entity → API view mappers of the training module.
 *
 * Pure functions: JSON columns are copied defensively so a view handed to the
 * engine or a client can never mutate the Sequelize instance behind it.
 */

/** Recovery score assumed while the athlete has no recovery data. */
const DEFAULT_RECOVERY_SCORE = 50;

// A type alias, not an interface: the engine takes plan weeks as plain records.
export type PlanWeekView = {
  weekNumber: number;
  phase: string;
  weeklyLoadTarget: number;
  workoutIds: string[];
};

export function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

export function toArrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map((entry) => toRecord(entry)) : [];
}

export function toArrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

/** Lower-cased weekday names; an empty selection means the default availability. */
export function normalizeDays(days?: string[]): string[] {
  if (!days || days.length === 0) {
    return [...TRAINING_DEFAULT_AVAILABILITY];
  }
  return days.map((day) => day.trim().toLowerCase()).filter(Boolean);
}

export function toAthleteView(athlete: Athlete): AthleteView {
  return {
    id: athlete.id,
    userId: athlete.userId,
    age: athlete.age,
    sex: athlete.sex,
    heightCm: athlete.heightCm,
    weightKg: athlete.weightKg,
    experienceLevel: athlete.experienceLevel,
    weeklyMileageKm: athlete.weeklyMileageKm,
    sessionsPerWeek: athlete.sessionsPerWeek,
    allowDoubles: athlete.allowDoubles ?? false,
    recentRaceResults: toArrayOfRecords(athlete.recentRaceResults),
    preferredTrainingDays: [...athlete.preferredTrainingDays],
    availableTrainingDays: [...athlete.availableTrainingDays],
    preferredWorkoutDurationMinutes: athlete.preferredWorkoutDurationMinutes,
    birthDate: athlete.birthDate ?? null,
    restingHeartRate: athlete.restingHeartRate ?? null,
    maxHeartRate: athlete.maxHeartRate ?? null,
    thresholdHeartRate: athlete.thresholdHeartRate ?? null,
    hrZonesMethod: athlete.hrZonesMethod ?? 'max_hr',
    hrZonesCustom: athlete.hrZonesCustom ?? null,
    runningSinceYear: athlete.runningSinceYear ?? null,
    limitations: athlete.limitations ?? null,
    preferredTimeOfDay: athlete.preferredTimeOfDay ?? 'any',
    longRunDay: athlete.longRunDay ?? null,
    longRunMaxDurationMinutes: athlete.longRunMaxDurationMinutes ?? null,
    fieldSources: { ...(athlete.fieldSources ?? {}) },
    createdAt: athlete.createdAt,
    updatedAt: athlete.updatedAt,
  };
}

export function toGoalView(goal: AthleteGoal): GoalView {
  return {
    id: goal.id,
    athleteId: goal.athleteId,
    type: goal.type ?? 'prepare_for_race',
    payload: goal.payload ?? null,
    raceDistance: goal.raceDistance,
    targetTimeSeconds: goal.targetTimeSeconds,
    targetDate: goal.targetDate ?? '',
    priority: goal.priority,
    status: goal.status,
    notes: goal.notes,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

export function toStateView(state: AthleteState): AthleteStateView {
  return {
    id: state.id,
    athleteId: state.athleteId,
    fitness: state.fitness,
    fatigue: state.fatigue,
    form: state.form,
    thresholdPaceSecondsPerKm: state.thresholdPaceSecondsPerKm,
    thresholdHeartRate: state.thresholdHeartRate,
    vo2max: state.vo2max,
    weeklyLoad: state.weeklyLoad,
    acuteLoad: state.acuteLoad,
    chronicLoad: state.chronicLoad,
    recoveryScore: state.recoveryScore,
    confidence: state.confidence,
    source: state.source,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt ?? state.createdAt,
  };
}

/** The engine's input shape of a stored state snapshot. */
export function toStateComputation(state: AthleteStateView): TrainingStateComputation {
  return {
    fitness: state.fitness,
    fatigue: state.fatigue,
    form: state.form,
    weeklyLoad: state.weeklyLoad,
    acuteLoad: state.acuteLoad,
    chronicLoad: state.chronicLoad,
    recoveryScore: state.recoveryScore ?? DEFAULT_RECOVERY_SCORE,
    thresholdPaceSecondsPerKm: state.thresholdPaceSecondsPerKm,
    thresholdHeartRate: state.thresholdHeartRate,
    vo2max: state.vo2max,
    confidence: state.confidence,
    source: state.source,
  };
}

export function toWorkoutAnalysisView(value: Record<string, unknown>): WorkoutAnalysisView {
  return {
    completion: Number(value.completion ?? 0),
    performanceDelta: Number(value.performanceDelta ?? 0),
    load: Number(value.load ?? 0),
    expectedLoad: Number(value.expectedLoad ?? 0),
    fatigueImpact: (value.fatigueImpact as WorkoutAnalysisView['fatigueImpact']) ?? 'low',
    confidence: Number(value.confidence ?? 0),
    analysisVersion: String(value.analysisVersion ?? 'analysis-v1'),
  };
}

export function toWorkoutView(workout: Workout): WorkoutView {
  return {
    id: workout.id,
    athleteId: workout.athleteId,
    goalId: workout.goalId,
    planId: workout.planId,
    weekNumber: workout.weekNumber,
    scheduledAt: workout.scheduledAt,
    type: workout.type,
    phase: workout.phase,
    status: workout.status,
    orderInWeek: workout.orderInWeek,
    durationMinutes: workout.durationMinutes,
    distanceKm: workout.distanceKm,
    target: toRecord(workout.target),
    steps: toArrayOfRecords(workout.steps),
    actual: workout.actual ? toRecord(workout.actual) : null,
    analysis: workout.analysis ? toWorkoutAnalysisView(workout.analysis) : null,
    completedAt: workout.completedAt,
    gearId: workout.gearId ?? null,
    deviceId: workout.deviceId ?? null,
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
  };
}

export function toPlanWeeks(value: Array<Record<string, unknown>>): PlanWeekView[] {
  return value.map((week) => ({
    weekNumber: Number(week.weekNumber ?? 0),
    phase: String(week.phase ?? 'base'),
    weeklyLoadTarget: Number(week.weeklyLoadTarget ?? 0),
    workoutIds: toArrayOfStrings(week.workoutIds),
  }));
}

/** Plan with its workouts; week `workoutIds` are rebuilt from the workouts actually passed in. */
export function toPlanView(plan: TrainingPlan, workouts: Workout[]): TrainingPlanView {
  const orderedWorkouts = workouts.map((workout) => toWorkoutView(workout));
  const planWeeks = toPlanWeeks(plan.weeks).map((week) => ({
    ...week,
    workoutIds: orderedWorkouts
      .filter((workout) => workout.weekNumber === week.weekNumber)
      .map((workout) => workout.id),
  }));

  return {
    id: plan.id,
    athleteId: plan.athleteId,
    goalId: plan.goalId,
    name: plan.name,
    notes: plan.notes,
    version: plan.version,
    startDate: plan.startDate,
    endDate: plan.endDate,
    trainingFrequency: plan.trainingFrequency,
    weeklyTargetKm: plan.weeklyTargetKm,
    status: plan.status,
    algorithmVersion: plan.algorithmVersion,
    weeks: planWeeks,
    workouts: orderedWorkouts,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export function toAdaptationEventView(event: AdaptationEvent): AdaptationEventView {
  return {
    id: event.id,
    athleteId: event.athleteId,
    planId: event.planId,
    workoutId: event.workoutId,
    type: event.type,
    input: toRecord(event.input),
    decision: toRecord(event.decision),
    reason: event.reason,
    confidence: event.confidence,
    status: event.status ?? 'applied',
    createdAt: event.createdAt,
  };
}
