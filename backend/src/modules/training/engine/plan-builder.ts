import { AthleteView, GoalView, WorkoutView } from '../interfaces/training-views.interface';
import {
  MANUAL_PLAN_FOCUS_TYPES,
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_WEEKS,
  TRAINING_DEFAULT_FREQUENCY,
  TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
  TRAINING_PHASE_WEEKLY_LOAD_MULTIPLIERS,
  TRAINING_PHASE_WORKOUT_TYPES,
  TRAINING_WEEKDAY_ORDER,
} from '../training.constants';
import {
  ManualPlanOptions,
  PlanBuildResult,
  RelativeWeek,
  TrainingStateComputation,
  WorkoutBuildResult,
} from './engine.types';
import { addDays, formatDate, resolvePhase, resolveWeekdayIndex } from './engine-utils';
import { buildWorkout } from './workout-prescription';

/*
 * Plan generation from a goal: phases, weekly volume, workout types and dates.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

/**
 * Maps a goal type onto its default workout emphasis.
 * Explicit user focus always wins; this only steers plans when the user
 * did not pick a manual focus.
 */
function resolveGoalFocusTypes(goal: GoalView): Array<WorkoutView['type']> | null {
  switch (goal.type) {
    case 'improve_speed':
      return ['interval', 'tempo'];
    case 'improve_pace':
      return ['tempo', 'threshold'];
    case 'build_endurance':
    case 'run_continuously':
    case 'ultra_preparation':
    case 'trail_preparation':
    case 'backyard_preparation':
    case 'increase_running_volume':
      return ['long_run', 'easy'];
    case 'improve_hills':
      return ['hill', 'long_run'];
    case 'improve_aerobic_fitness':
      return ['tempo', 'easy'];
    case 'start_running':
    case 'return_to_running':
    case 'build_consistency':
    case 'lose_weight':
    case 'maintain_fitness':
    case 'general_health':
      return ['easy', 'recovery'];
    default:
      // Race preparation, challenges and custom goals keep the phase defaults.
      return null;
  }
}

export function generatePlan(
  athlete: AthleteView,
  goal: GoalView,
  state: TrainingStateComputation,
  startDate: Date,
  options: ManualPlanOptions = {},
): PlanBuildResult {
  const weeks = options.totalWeeks
    ? Math.max(MANUAL_PLAN_MIN_WEEKS, Math.min(MANUAL_PLAN_MAX_WEEKS, options.totalWeeks))
    : resolvePlanWeeks(goal, startDate);
  const trainingFrequency = Math.max(3, Math.min(7, athlete.sessionsPerWeek || TRAINING_DEFAULT_FREQUENCY));
  const weeklyTargetKm = resolveWeeklyTargetKm(athlete, state);
  // Explicit user focus wins; otherwise the goal type steers the emphasis.
  const focusTypes = resolveFocusTypes(options.focus) ?? resolveGoalFocusTypes(goal);
  const workouts: WorkoutBuildResult[] = [];
  const planWeeks: Array<Record<string, unknown>> = [];

  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    const weekNumber = weekIndex + 1;
    const phase = resolvePhase(weekNumber, weeks);
    const weeklyMultiplier =
      TRAINING_PHASE_WEEKLY_LOAD_MULTIPLIERS[phase as keyof typeof TRAINING_PHASE_WEEKLY_LOAD_MULTIPLIERS];
    const weekLoadTarget = Math.round(weeklyTargetKm * weeklyMultiplier);
    const workoutTypes = resolveWorkoutTypesForPhase(phase, focusTypes);
    const availableDays =
      athlete.availableTrainingDays.length > 0 ? athlete.availableTrainingDays : [...TRAINING_WEEKDAY_ORDER];
    const dates = resolveWorkoutDates(
      startDate,
      weekNumber,
      availableDays,
      trainingFrequency,
      options.preferredLongRunDay,
    );
    const weekWorkouts: string[] = [];

    dates.forEach((scheduledAt, index) => {
      const workoutType = resolveWorkoutType(index, workoutTypes, phase, trainingFrequency);
      const workout = buildWorkout({
        athlete,
        goal,
        state,
        phase,
        weekNumber,
        workoutType,
        scheduledAt,
        orderInWeek: index + 1,
        weekLoadTarget,
      });

      weekWorkouts.push(`${weekNumber}-${index + 1}`);
      workouts.push(workout);
    });

    planWeeks.push({
      weekNumber,
      phase,
      weeklyLoadTarget: weekLoadTarget,
      workoutIds: weekWorkouts,
    });
  }

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(addDays(startDate, weeks * 7 - 1)),
    trainingFrequency,
    weeklyTargetKm,
    weeks: planWeeks,
    workouts,
  };
}

function resolveWorkoutDates(
  startDate: Date,
  weekNumber: number,
  availableDays: string[],
  trainingFrequency: number,
  preferredLongRunDay?: number,
): Date[] {
  const weekStart = addDays(startDate, (weekNumber - 1) * 7);
  const available = availableDays.length > 0 ? availableDays : [...TRAINING_WEEKDAY_ORDER];
  const dayIndexes = available
    .map((day) => TRAINING_WEEKDAY_ORDER.indexOf(day as (typeof TRAINING_WEEKDAY_ORDER)[number]))
    .filter((index) => index >= 0)
    .slice(0, trainingFrequency);

  if (dayIndexes.length === 0) {
    return Array.from({ length: trainingFrequency }, (_, index) => addDays(weekStart, index * 2));
  }

  // Map weekday indexes onto the rolling 7-day week window so each selected
  // weekday lands on its real calendar day regardless of the start weekday.
  const startWeekday = resolveWeekdayIndex(startDate);
  const dates = dayIndexes.map((dayIndex) => {
    const offset = (dayIndex - startWeekday + 7) % 7;
    return addDays(weekStart, offset);
  });
  dates.sort((left, right) => left.getTime() - right.getTime());

  // The long run is assigned to the chronologically last session, so move the
  // preferred long run day's date to the end while keeping the rest in order.
  if (preferredLongRunDay !== undefined && dayIndexes.includes(preferredLongRunDay)) {
    const preferredOffset = (preferredLongRunDay - startWeekday + 7) % 7;
    const preferredDate = addDays(weekStart, preferredOffset);
    const withoutPreferred = dates.filter((date) => date.getTime() !== preferredDate.getTime());
    return [...withoutPreferred, preferredDate];
  }

  return dates;
}

function resolveWorkoutType(
  index: number,
  workoutTypes: Array<WorkoutView['type']>,
  phase: string,
  trainingFrequency: number,
): WorkoutView['type'] {
  if (trainingFrequency <= 1) {
    return workoutTypes[0] || 'easy';
  }

  if (index === trainingFrequency - 1) {
    return 'long_run';
  }

  if (index === 0) {
    return workoutTypes[0] || 'easy';
  }

  if (index === 1 && phase !== 'recovery') {
    return workoutTypes[1] || 'tempo';
  }

  return workoutTypes[Math.min(index, workoutTypes.length - 1)] || 'easy';
}

function resolveWorkoutTypesForPhase(
  phase: string,
  focusTypes: Array<WorkoutView['type']> | null = null,
): Array<WorkoutView['type']> {
  const phaseTypes = (TRAINING_PHASE_WORKOUT_TYPES[phase as keyof typeof TRAINING_PHASE_WORKOUT_TYPES] ||
    TRAINING_PHASE_WORKOUT_TYPES.base) as Array<WorkoutView['type']>;

  if (!focusTypes || focusTypes.length === 0) {
    return phaseTypes;
  }

  // Focus acts as a preference filter. The long run is assigned positionally
  // (last session of the week), so it must stay out of the index-based list.
  const filtered = phaseTypes.filter((type) => focusTypes.includes(type) && type !== 'long_run');
  if (filtered.length === 0) {
    return phaseTypes;
  }

  const supplements = focusTypes.filter((type) => !filtered.includes(type) && type !== 'long_run');
  return [...filtered, ...supplements];
}

/** Maps user-selected focus labels to workout types, dropping unsupported values. */
function resolveFocusTypes(focus?: string[]): Array<WorkoutView['type']> | null {
  if (!focus || focus.length === 0) {
    return null;
  }

  const mapped = focus
    .map((label) => label as WorkoutView['type'])
    .filter((type) => (MANUAL_PLAN_FOCUS_TYPES as readonly string[]).includes(type));

  return mapped.length > 0 ? mapped : null;
}

function resolvePlanWeeks(goal: GoalView, startDate: Date): number {
  // Goal target date is optional ("Just running"); fall back to a 12-week default duration.
  if (!goal.targetDate) {
    return 12;
  }

  const targetDate = new Date(goal.targetDate);
  const diffDays = Math.max(1, Math.ceil((targetDate.getTime() - startDate.getTime()) / 86_400_000));
  return Math.max(6, Math.min(16, Math.ceil(diffDays / 7)));
}

function resolveWeeklyTargetKm(athlete: AthleteView, state: TrainingStateComputation): number {
  const baseMileage = athlete.weeklyMileageKm ?? TRAINING_DEFAULT_WEEKLY_MILEAGE_KM;
  const experienceMultiplier =
    athlete.experienceLevel === 'beginner' ? 0.9 : athlete.experienceLevel === 'advanced' ? 1.15 : 1;
  const fatigueMultiplier = state.recoveryScore < 45 ? 0.85 : state.recoveryScore < 65 ? 0.92 : 1;
  return Math.round(baseMileage * experienceMultiplier * fatigueMultiplier);
}

/**
 * Dated generated plan → relative weeks (draft format). Keys reuse the
 * generator's order in week (`w{week}-{order}`), so ids shown in the manual
 * preview (`{week}-{order}`) map onto keys one to one.
 */
export function toRelativeWeeks(generated: PlanBuildResult): RelativeWeek[] {
  return generated.weeks.map((week) => {
    const weekNumber = Number(week.weekNumber);
    const weekWorkouts = generated.workouts
      .filter((workout) => workout.weekNumber === weekNumber)
      .sort((left, right) => left.orderInWeek - right.orderInWeek)
      .map((workout) => ({
        key: `w${weekNumber}-${workout.orderInWeek}`,
        dayOfWeek: resolveWeekdayIndex(workout.scheduledAt),
        orderInWeek: workout.orderInWeek,
        type: workout.type,
        phase: workout.phase,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: workout.target,
        steps: workout.steps,
      }));

    const phase = String(week.phase ?? 'base');
    return {
      weekNumber,
      phase,
      weeklyLoadTarget: Number(week.weeklyLoadTarget ?? 0),
      workouts: weekWorkouts,
    };
  });
}
