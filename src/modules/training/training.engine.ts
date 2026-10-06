import { AthleteView, GoalView, WorkoutAnalysisView, WorkoutView } from './interfaces/training-views.interface';
import {
  ATHLETE_GOAL_DISTANCES,
  MANUAL_PLAN_FOCUS_TYPES,
  MANUAL_PLAN_MAX_DISTANCE_KM,
  MANUAL_PLAN_MAX_DURATION_MINUTES,
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_DURATION_MINUTES,
  MANUAL_PLAN_MIN_WEEKS,
  REBUILD_VOLUME_SCALE_MAX,
  REBUILD_VOLUME_SCALE_MIN,
  TRAINING_DEFAULT_DURATION_MINUTES,
  TRAINING_DEFAULT_FREQUENCY,
  TRAINING_DEFAULT_TARGET_CONFIDENCE,
  TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
  TRAINING_PHASE_WEEKLY_LOAD_MULTIPLIERS,
  TRAINING_PHASE_WORKOUT_TYPES,
  TRAINING_STATE_SOURCE,
  TRAINING_WEEKDAY_ORDER,
  WORKOUT_TYPE_INTENSITY_FACTORS,
} from './training.constants';

/** Session types that must not land on adjacent days. */
const INTENSIVE_WORKOUT_TYPES: readonly string[] = ['tempo', 'threshold', 'interval', 'hill', 'race'];

export interface TrainingStateComputation {
  fitness: number;
  fatigue: number;
  form: number;
  weeklyLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  recoveryScore: number;
  thresholdPaceSecondsPerKm: number | null;
  thresholdHeartRate: number | null;
  vo2max: number | null;
  confidence: number;
  source: string;
}

export interface WorkoutBuildResult {
  type: WorkoutView['type'];
  phase: string;
  weekNumber: number;
  scheduledAt: Date;
  orderInWeek: number;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

export interface ManualPlanOptions {
  /** Desired number of training weeks chosen by the user. */
  totalWeeks?: number;
  /** Preferred weekday index (0 = Monday) for the long run. */
  preferredLongRunDay?: number;
  /** Workout types the user wants to see in the plan. */
  focus?: string[];
}

export interface PlanBuildResult {
  startDate: string;
  endDate: string;
  trainingFrequency: number;
  weeklyTargetKm: number;
  weeks: Array<Record<string, unknown>>;
  workouts: WorkoutBuildResult[];
}

export interface WorkoutAnalysisInput {
  plannedWorkout: WorkoutView;
  actualDurationMinutes: number;
  actualDistanceKm: number;
  actualAveragePaceSecondsPerKm?: number;
  actualAverageHeartRate?: number;
  rpe?: number;
}

export interface WorkoutAnalysisResult {
  analysis: WorkoutAnalysisView;
  trainingLoad: number;
  intensityFactor: number;
  fatigueImpact: WorkoutAnalysisView['fatigueImpact'];
}

export interface AdaptationResult {
  action: string;
  reason: string;
  confidence: number;
  changes: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Plan lifecycle transforms
// ---------------------------------------------------------------------------

/** Athlete metrics used by rebuild flows. */
export interface AthleteMetrics {
  capturedAt?: string;
  thresholdPaceSecondsPerKm?: number | null;
  thresholdHeartRate?: number | null;
  maxHeartRate?: number | null;
  restingHeartRate?: number | null;
  weeklyMileageKm?: number | null;
  longestRunKm?: number | null;
  recentResult?: { distance: string; timeSeconds: number; date: string } | null;
  source?: string;
}

/** Workout of a relative (undated) plan week; `dayOfWeek`: 0 = Monday. */
export interface RelativeWorkout {
  key: string;
  dayOfWeek: number;
  orderInWeek: number;
  type: WorkoutView['type'];
  phase: string;
  title?: string;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

/** Relative plan structure stored on drafts. */
export interface RelativeWeek {
  weekNumber: number;
  phase: string;
  title?: string;
  intent?: string;
  weeklyLoadTarget?: number;
  workouts: RelativeWorkout[];
}

/** Concrete dated workout produced by materializeWeeks. */
export interface MaterializedWorkout {
  key: string;
  weekNumber: number;
  scheduledAt: Date;
  orderInWeek: number;
  type: WorkoutView['type'];
  phase: string;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

export interface MaterializeResult {
  startDate: string;
  endDate: string;
  totalWeeks: number;
  /** Dated week records ready for `plan.weeks` (workoutIds hold keys until persist). */
  weeks: Array<Record<string, unknown>>;
  workouts: MaterializedWorkout[];
  dropped: Array<{ key: string; reason: string }>;
}

export interface RemapResult {
  weeks: RelativeWeek[];
  removed: Array<{ key: string; reason: string }>;
}

export interface PlanDiffAdjustment {
  code: string;
  params?: Record<string, unknown>;
}

export interface PlanDiffWorkout {
  key: string;
  change: 'added' | 'removed' | 'modified';
  fields?: Record<string, [unknown, unknown]>;
  reason?: string;
}

export interface PlanDiffWeek {
  weekNumber: number;
  change: 'added' | 'removed' | 'modified';
  workouts: PlanDiffWorkout[];
}

export interface PlanDiff {
  summary: {
    weeklyVolumeKm: { before: number[]; after: number[] };
    peakWeekKm: { before: number; after: number };
    longestRunKm: { before: number | null; after: number | null };
    thresholdPace: { before: number | null; after: number | null };
    totalWeeks: { before: number; after: number };
    adjustments: PlanDiffAdjustment[];
  };
  weeks: PlanDiffWeek[];
}

/** Minimal workout shape extractFinalVersion consumes. */
export interface ExtractableWorkout {
  /** Persisted id; used as the relative key when projecting an active plan. */
  id?: string;
  weekNumber: number;
  orderInWeek: number;
  scheduledAt: Date;
  type: string;
  phase: string;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

/** Error name used when a target-date resize is impossible. */
export const PLAN_RESIZE_ERROR = 'PLAN_RESIZE_NOT_POSSIBLE';

/** Options of materializeWeeks. */
export interface MaterializeOptions {
  /**
   * Moves first-week sessions that fall before the start weekday. Disabled when
   * the weeks continue an already running plan, where every weekday is valid.
   */
  relocateFirstWeek?: boolean;
}

export class TrainingEngine {
  /**
   * Maps a goal type onto its default workout emphasis.
   * Explicit user focus always wins; this only steers plans when the user
   * did not pick a manual focus.
   */
  private resolveGoalFocusTypes(goal: GoalView): Array<WorkoutView['type']> | null {
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

  /**
   * Derives the threshold pace directly from the universal goal payload
   * (target finish time over a distance, or an explicit target pace).
   */
  private resolveUniversalGoalPace(goal: GoalView | null): number | null {
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
  createWorkoutBlueprint(input: {
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
    return this.buildWorkout(input);
  }

  calculateTrainingState(
    athlete: AthleteView,
    recentLoads: Array<{ load: number; occurredAt: Date }>,
    goal: GoalView | null,
  ): TrainingStateComputation {
    const sortedLoads = [...recentLoads].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
    const now = new Date();

    const acuteLoad = this.sumLoadWithin(sortedLoads, now, 7);
    const chronicLoad = this.sumLoadWithin(sortedLoads, now, 42) / 6;
    const weeklyLoad = acuteLoad;
    const fitness = chronicLoad;
    const fatigue = acuteLoad;
    const form = fitness - fatigue;
    const recoveryScore = this.clamp(100 - fatigue + form * 0.5, 0, 100);

    const thresholdPaceSecondsPerKm = this.resolveThresholdPace(athlete, goal);
    const thresholdHeartRate = this.resolveThresholdHeartRate(athlete, goal);
    const vo2max = thresholdPaceSecondsPerKm ? this.estimateVo2maxFromThresholdPace(thresholdPaceSecondsPerKm) : null;

    const confidence = this.resolveConfidence(athlete, sortedLoads.length, thresholdPaceSecondsPerKm);

    return {
      fitness,
      fatigue,
      form,
      weeklyLoad,
      acuteLoad,
      chronicLoad,
      recoveryScore,
      thresholdPaceSecondsPerKm,
      thresholdHeartRate,
      vo2max,
      confidence,
      source: TRAINING_STATE_SOURCE,
    };
  }

  calculateTrainingLoad(workout: WorkoutView, actual?: WorkoutAnalysisView): { load: number; intensityFactor: number } {
    const intensityFactor = this.resolveIntensityFactor(workout.type);
    const durationMinutes = actual ? workout.durationMinutes * actual.completion : workout.durationMinutes;
    const completionFactor = actual ? this.clamp(actual.completion, 0.5, 1.5) : 1;
    const load = Math.round(durationMinutes * intensityFactor * completionFactor);

    return { load, intensityFactor };
  }

  analyzeWorkout(input: WorkoutAnalysisInput): WorkoutAnalysisResult {
    const planned = input.plannedWorkout;
    const durationRatio = input.actualDurationMinutes / Math.max(planned.durationMinutes, 1);
    const distanceRatio = input.actualDistanceKm / Math.max(planned.distanceKm, 0.1);
    const completion = this.clamp((durationRatio + distanceRatio) / 2, 0, 1.5);
    const paceBaseline = this.resolveTargetPace(planned);
    const actualPace =
      input.actualAveragePaceSecondsPerKm ??
      this.resolveActualPace(input.actualDurationMinutes, input.actualDistanceKm);
    const performanceDelta =
      paceBaseline && actualPace ? this.clamp((paceBaseline - actualPace) / paceBaseline, -1, 1) : 0;

    const fatigueImpact = this.resolveFatigueImpact(completion, performanceDelta, input.rpe);
    const actualView: WorkoutAnalysisView = {
      completion,
      performanceDelta,
      load: 0,
      expectedLoad: 0,
      fatigueImpact,
      confidence: this.resolveAnalysisConfidence(completion, performanceDelta, input),
      analysisVersion: 'analysis-v1',
    };
    const loadResult = this.calculateTrainingLoad(planned, actualView);

    return {
      analysis: {
        ...actualView,
        load: loadResult.load,
        expectedLoad: Math.round(planned.durationMinutes * this.resolveIntensityFactor(planned.type)),
      },
      trainingLoad: loadResult.load,
      intensityFactor: loadResult.intensityFactor,
      fatigueImpact,
    };
  }

  adaptPlan(
    planWeeks: Array<Record<string, unknown>>,
    workouts: WorkoutView[],
    state: TrainingStateComputation,
    analysis: WorkoutAnalysisView,
    forcedAction?: string,
  ): AdaptationResult {
    const action = forcedAction || this.resolveAdaptationAction(state, analysis);
    const changes: Array<Record<string, unknown>> = [];

    if (action === 'REDUCE_INTENSITY' || action === 'ADD_RECOVERY') {
      const nextHardWorkout = workouts.find(
        (workout) => workout.status === 'planned' && this.isHardWorkout(workout.type),
      );
      if (nextHardWorkout) {
        changes.push(this.transformWorkoutToRecovery(nextHardWorkout));
      }
    }

    if (action === 'REDUCE_VOLUME') {
      changes.push(...this.reduceUpcomingLoad(workouts, 0.8));
    }

    if (action === 'INCREASE_VOLUME') {
      changes.push(...this.increaseUpcomingLoad(workouts, 1.1));
    }

    if (action === 'INCREASE_INTENSITY') {
      const nextQualityWorkout = workouts.find(
        (workout) => workout.status === 'planned' && this.isQualityWorkout(workout.type),
      );
      if (nextQualityWorkout) {
        changes.push(this.intensifyWorkout(nextQualityWorkout));
      }
    }

    if (action === 'MOVE') {
      const nextWorkout = workouts.find((workout) => workout.status === 'planned');
      if (nextWorkout) {
        changes.push({
          workoutId: nextWorkout.id,
          scheduledAt: this.moveToNextAvailableDay(nextWorkout.scheduledAt, workouts),
        });
      }
    }

    if (action === 'REPLACE') {
      const nextWorkout = workouts.find((workout) => workout.status === 'planned');
      if (nextWorkout) {
        changes.push(this.transformWorkoutToRecovery(nextWorkout));
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
        note: 'No plan changes were necessary.',
      });
    }

    return {
      action,
      reason: this.resolveAdaptationReason(action, state, analysis),
      confidence: this.resolveAdaptationConfidence(state, analysis),
      changes,
    };
  }

  generatePlan(
    athlete: AthleteView,
    goal: GoalView,
    state: TrainingStateComputation,
    startDate: Date,
    options: ManualPlanOptions = {},
  ): PlanBuildResult {
    const weeks = options.totalWeeks
      ? Math.max(MANUAL_PLAN_MIN_WEEKS, Math.min(MANUAL_PLAN_MAX_WEEKS, options.totalWeeks))
      : this.resolvePlanWeeks(goal, startDate);
    const trainingFrequency = Math.max(3, Math.min(7, athlete.sessionsPerWeek || TRAINING_DEFAULT_FREQUENCY));
    const weeklyTargetKm = this.resolveWeeklyTargetKm(athlete, state);
    // Explicit user focus wins; otherwise the goal type steers the emphasis.
    const focusTypes = this.resolveFocusTypes(options.focus) ?? this.resolveGoalFocusTypes(goal);
    const workouts: WorkoutBuildResult[] = [];
    const planWeeks: Array<Record<string, unknown>> = [];

    for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
      const weekNumber = weekIndex + 1;
      const phase = this.resolvePhase(weekNumber, weeks);
      const weeklyMultiplier =
        TRAINING_PHASE_WEEKLY_LOAD_MULTIPLIERS[phase as keyof typeof TRAINING_PHASE_WEEKLY_LOAD_MULTIPLIERS];
      const weekLoadTarget = Math.round(weeklyTargetKm * weeklyMultiplier);
      const workoutTypes = this.resolveWorkoutTypesForPhase(phase, focusTypes);
      const availableDays =
        athlete.availableTrainingDays.length > 0 ? athlete.availableTrainingDays : [...TRAINING_WEEKDAY_ORDER];
      const dates = this.resolveWorkoutDates(
        startDate,
        weekNumber,
        availableDays,
        trainingFrequency,
        options.preferredLongRunDay,
      );
      const weekWorkouts: string[] = [];

      dates.forEach((scheduledAt, index) => {
        const workoutType = this.resolveWorkoutType(index, workoutTypes, phase, trainingFrequency);
        const workout = this.buildWorkout({
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
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(this.addDays(startDate, weeks * 7 - 1)),
      trainingFrequency,
      weeklyTargetKm,
      weeks: planWeeks,
      workouts,
    };
  }

  private buildWorkout(input: {
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
    const durationMinutes = this.resolveWorkoutDuration(input.athlete, input.workoutType, input.state);
    const distanceKm = this.resolveWorkoutDistance(durationMinutes, input.state, input.workoutType);
    const thresholdPace = input.state.thresholdPaceSecondsPerKm ?? this.resolveGoalPace(input.goal, input.athlete);
    const target = this.buildWorkoutTarget(input.workoutType, thresholdPace);
    const steps = this.buildWorkoutSteps(input.workoutType, durationMinutes, target);

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

  private buildWorkoutTarget(
    workoutType: WorkoutView['type'],
    thresholdPaceSecondsPerKm: number | null,
  ): Record<string, unknown> {
    const paceRange = this.resolvePaceRange(workoutType, thresholdPaceSecondsPerKm);
    return {
      paceMinSecondsPerKm: paceRange.min,
      paceMaxSecondsPerKm: paceRange.max,
      zone: paceRange.zone,
      workoutType,
    };
  }

  private buildWorkoutSteps(
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
        repetitions: this.resolveRepetitions(workoutType),
        target,
      },
      { type: 'recovery', durationMinutes: Math.max(6, Math.round(durationMinutes * 0.12)) },
      { type: 'cooldown', durationMinutes: Math.max(5, Math.round(durationMinutes * 0.15)) },
    ];
  }

  private resolveWorkoutDuration(
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

  private resolveWorkoutDistance(
    durationMinutes: number,
    state: TrainingStateComputation,
    workoutType: WorkoutView['type'],
  ): number {
    if (durationMinutes === 0) {
      return 0;
    }

    const paceSeconds = state.thresholdPaceSecondsPerKm ?? 360;
    const targetPace = this.resolvePaceRange(workoutType, paceSeconds).min;
    const distance = (durationMinutes * 60) / targetPace;
    return Math.round(distance * 10) / 10;
  }

  private resolveWorkoutDates(
    startDate: Date,
    weekNumber: number,
    availableDays: string[],
    trainingFrequency: number,
    preferredLongRunDay?: number,
  ): Date[] {
    const weekStart = this.addDays(startDate, (weekNumber - 1) * 7);
    const available = availableDays.length > 0 ? availableDays : [...TRAINING_WEEKDAY_ORDER];
    const dayIndexes = available
      .map((day) => TRAINING_WEEKDAY_ORDER.indexOf(day as (typeof TRAINING_WEEKDAY_ORDER)[number]))
      .filter((index) => index >= 0)
      .slice(0, trainingFrequency);

    if (dayIndexes.length === 0) {
      return Array.from({ length: trainingFrequency }, (_, index) => this.addDays(weekStart, index * 2));
    }

    // Map weekday indexes onto the rolling 7-day week window so each selected
    // weekday lands on its real calendar day regardless of the start weekday.
    const startWeekday = this.resolveWeekdayIndex(startDate);
    const dates = dayIndexes.map((dayIndex) => {
      const offset = (dayIndex - startWeekday + 7) % 7;
      return this.addDays(weekStart, offset);
    });
    dates.sort((left, right) => left.getTime() - right.getTime());

    // The long run is assigned to the chronologically last session, so move the
    // preferred long run day's date to the end while keeping the rest in order.
    if (preferredLongRunDay !== undefined && dayIndexes.includes(preferredLongRunDay)) {
      const preferredOffset = (preferredLongRunDay - startWeekday + 7) % 7;
      const preferredDate = this.addDays(weekStart, preferredOffset);
      const withoutPreferred = dates.filter((date) => date.getTime() !== preferredDate.getTime());
      return [...withoutPreferred, preferredDate];
    }

    return dates;
  }

  private resolveWorkoutType(
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

  private resolveWorkoutTypesForPhase(
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
  private resolveFocusTypes(focus?: string[]): Array<WorkoutView['type']> | null {
    if (!focus || focus.length === 0) {
      return null;
    }

    const mapped = focus
      .map((label) => label as WorkoutView['type'])
      .filter((type) => (MANUAL_PLAN_FOCUS_TYPES as readonly string[]).includes(type));

    return mapped.length > 0 ? mapped : null;
  }

  private resolvePlanWeeks(goal: GoalView, startDate: Date): number {
    // Goal target date is optional ("Just running"); fall back to a 12-week default duration.
    if (!goal.targetDate) {
      return 12;
    }

    const targetDate = new Date(goal.targetDate);
    const diffDays = Math.max(1, Math.ceil((targetDate.getTime() - startDate.getTime()) / 86_400_000));
    return Math.max(6, Math.min(16, Math.ceil(diffDays / 7)));
  }

  private resolvePhase(weekNumber: number, totalWeeks: number): string {
    if (weekNumber === totalWeeks) {
      return 'race';
    }
    if (weekNumber >= totalWeeks - 1) {
      return 'taper';
    }
    if (weekNumber % 4 === 0) {
      return 'recovery';
    }
    if (weekNumber <= 2) {
      return 'base';
    }
    if (weekNumber <= totalWeeks - 3) {
      return 'build';
    }
    return 'specific';
  }

  private resolveWeeklyTargetKm(athlete: AthleteView, state: TrainingStateComputation): number {
    const baseMileage = athlete.weeklyMileageKm ?? TRAINING_DEFAULT_WEEKLY_MILEAGE_KM;
    const experienceMultiplier =
      athlete.experienceLevel === 'beginner' ? 0.9 : athlete.experienceLevel === 'advanced' ? 1.15 : 1;
    const fatigueMultiplier = state.recoveryScore < 45 ? 0.85 : state.recoveryScore < 65 ? 0.92 : 1;
    return Math.round(baseMileage * experienceMultiplier * fatigueMultiplier);
  }

  private resolveAdaptationAction(state: TrainingStateComputation, analysis: WorkoutAnalysisView): string {
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

  private resolveAdaptationReason(
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

  private resolveAdaptationConfidence(state: TrainingStateComputation, analysis: WorkoutAnalysisView): number {
    const base = 0.65 + analysis.completion * 0.1 + Math.abs(analysis.performanceDelta) * 0.1;
    return this.clamp(base + (state.confidence - 0.5) * 0.3, 0, 1);
  }

  private resolvePaceRange(
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

  private resolveTargetPace(workout: WorkoutView): number | null {
    const paceMin = workout.target.paceMinSecondsPerKm;
    const paceMax = workout.target.paceMaxSecondsPerKm;
    if (typeof paceMin === 'number' && typeof paceMax === 'number' && paceMin > 0 && paceMax > 0) {
      return Math.round((paceMin + paceMax) / 2);
    }

    return null;
  }

  private resolveActualPace(durationMinutes: number, distanceKm: number): number | null {
    if (distanceKm <= 0) {
      return null;
    }

    return Math.round((durationMinutes * 60) / distanceKm);
  }

  private resolveFatigueImpact(
    completion: number,
    performanceDelta: number,
    rpe?: number,
  ): WorkoutAnalysisView['fatigueImpact'] {
    if (completion < 0.8 || performanceDelta < -0.12 || (typeof rpe === 'number' && rpe >= 8)) {
      return 'high';
    }

    if (completion < 0.95 || performanceDelta < -0.03 || (typeof rpe === 'number' && rpe >= 6)) {
      return 'moderate';
    }

    return 'low';
  }

  private resolveAnalysisConfidence(completion: number, performanceDelta: number, input: WorkoutAnalysisInput): number {
    const hasHeartRate = typeof input.actualAverageHeartRate === 'number';
    const hasPace = typeof input.actualAveragePaceSecondsPerKm === 'number';
    const confidence = 0.55 + Math.min(0.2, completion * 0.1) + Math.min(0.15, Math.abs(performanceDelta) * 0.2);
    return this.clamp(confidence + (hasHeartRate ? 0.05 : 0) + (hasPace ? 0.05 : 0), 0, 1);
  }

  private resolveConfidence(athlete: AthleteView, loadCount: number, thresholdPaceSecondsPerKm: number | null): number {
    const base = TRAINING_DEFAULT_TARGET_CONFIDENCE + Math.min(0.2, loadCount / 100);
    const paceBonus = thresholdPaceSecondsPerKm ? 0.08 : 0;
    const profileBonus = athlete.recentRaceResults.length > 0 ? 0.1 : 0;
    return this.clamp(base + paceBonus + profileBonus, 0, 1);
  }

  private resolveThresholdPace(athlete: AthleteView, goal: GoalView | null): number | null {
    // Universal payload takes priority: the engine distinguishes goal types
    // instead of treating every goal as a generic race target.
    const universalPace = this.resolveUniversalGoalPace(goal);
    if (universalPace) {
      return universalPace;
    }

    // Legacy race columns stay supported for goals created before the
    // universal model.
    if (
      goal?.targetTimeSeconds &&
      ATHLETE_GOAL_DISTANCES.includes(goal.raceDistance as (typeof ATHLETE_GOAL_DISTANCES)[number])
    ) {
      const distanceKm = this.resolveDistanceKilometres(goal.raceDistance);
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

  private resolveThresholdHeartRate(athlete: AthleteView, goal: GoalView | null): number | null {
    const bestResult = athlete.recentRaceResults[0];
    if (bestResult && typeof bestResult.thresholdHeartRate === 'number') {
      return bestResult.thresholdHeartRate;
    }

    if (goal?.targetTimeSeconds) {
      return 165;
    }

    return null;
  }

  private estimateVo2maxFromThresholdPace(thresholdPaceSecondsPerKm: number): number {
    return this.clamp(Math.round(80 - thresholdPaceSecondsPerKm / 10), 35, 70);
  }

  private resolveGoalPace(goal: GoalView, athlete: AthleteView): number {
    const thresholdPace = this.resolveThresholdPace(athlete, goal);
    return thresholdPace ?? 360;
  }

  private resolveDistanceKilometres(distance: string): number {
    const map: Record<(typeof ATHLETE_GOAL_DISTANCES)[number], number> = {
      '5k': 5,
      '10k': 10,
      half_marathon: 21.097,
      marathon: 42.195,
      just_running: 0,
    };

    return map[distance as keyof typeof map] || 0;
  }

  private resolveRepetitions(workoutType: WorkoutView['type']): number {
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

  private resolveIntensityFactor(workoutType: WorkoutView['type']): number {
    return WORKOUT_TYPE_INTENSITY_FACTORS[workoutType as keyof typeof WORKOUT_TYPE_INTENSITY_FACTORS];
  }

  private sumLoadWithin(loads: Array<{ load: number; occurredAt: Date }>, now: Date, days: number): number {
    const lowerBound = now.getTime() - days * 86_400_000;
    return loads.filter((load) => load.occurredAt.getTime() >= lowerBound).reduce((sum, load) => sum + load.load, 0);
  }

  private isHardWorkout(type: WorkoutView['type']): boolean {
    return ['tempo', 'threshold', 'interval', 'hill', 'race'].includes(type);
  }

  private isQualityWorkout(type: WorkoutView['type']): boolean {
    return ['tempo', 'threshold', 'interval', 'hill'].includes(type);
  }

  private transformWorkoutToRecovery(workout: WorkoutView): Record<string, unknown> {
    return {
      workoutId: workout.id,
      type: 'recovery',
      durationMinutes: Math.max(20, Math.round(workout.durationMinutes * 0.7)),
      distanceKm: Math.round(workout.distanceKm * 0.75 * 10) / 10,
    };
  }

  private reduceUpcomingLoad(workouts: WorkoutView[], multiplier: number): Array<Record<string, unknown>> {
    return workouts
      .filter((workout) => workout.status === 'planned')
      .slice(0, 3)
      .map((workout) => ({
        workoutId: workout.id,
        durationMinutes: Math.max(20, Math.round(workout.durationMinutes * multiplier)),
        distanceKm: Math.round(workout.distanceKm * multiplier * 10) / 10,
      }));
  }

  private increaseUpcomingLoad(workouts: WorkoutView[], multiplier: number): Array<Record<string, unknown>> {
    return workouts
      .filter((workout) => workout.status === 'planned')
      .slice(0, 2)
      .map((workout) => ({
        workoutId: workout.id,
        durationMinutes: Math.round(workout.durationMinutes * multiplier),
        distanceKm: Math.round(workout.distanceKm * multiplier * 10) / 10,
      }));
  }

  private intensifyWorkout(workout: WorkoutView): Record<string, unknown> {
    const nextType = workout.type === 'tempo' ? 'threshold' : workout.type === 'threshold' ? 'interval' : 'tempo';
    return {
      workoutId: workout.id,
      type: nextType,
      durationMinutes: workout.durationMinutes,
    };
  }

  private moveToNextAvailableDay(scheduledAt: Date, workouts: WorkoutView[]): string {
    const takenDays = new Set(workouts.map((workout) => this.formatDate(workout.scheduledAt)));
    let nextDate = new Date(scheduledAt);

    for (let index = 0; index < 7; index += 1) {
      nextDate = this.addDays(nextDate, 1);
      const candidate = this.formatDate(nextDate);
      if (!takenDays.has(candidate)) {
        return candidate;
      }
    }

    return this.formatDate(this.addDays(scheduledAt, 1));
  }

  /**
   * Validates a user-provided workout override against the engine constraints.
   * The override carries only changed fields; the caller must merge it with the
   * existing workout before calling.
   */
  validateWorkoutOverride(input: { type: string; dayOfWeek?: number; distanceKm?: number; durationMinutes?: number }):
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
   * Dated generated plan → relative weeks (draft format). Keys reuse the
   * generator's order in week (`w{week}-{order}`), so ids shown in the manual
   * preview (`{week}-{order}`) map onto keys one to one.
   */
  toRelativeWeeks(generated: PlanBuildResult): RelativeWeek[] {
    return generated.weeks.map((week) => {
      const weekNumber = Number(week.weekNumber);
      const weekWorkouts = generated.workouts
        .filter((workout) => workout.weekNumber === weekNumber)
        .sort((left, right) => left.orderInWeek - right.orderInWeek)
        .map((workout) => ({
          key: `w${weekNumber}-${workout.orderInWeek}`,
          dayOfWeek: this.resolveWeekdayIndex(workout.scheduledAt),
          orderInWeek: workout.orderInWeek,
          type: workout.type,
          phase: workout.phase,
          title: this.getWorkoutTitle(workout.type),
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
        title: this.getWeekTitle(phase, weekNumber),
        intent: this.getWeekIntent(phase, weekNumber),
        workouts: weekWorkouts,
      };
    });
  }

  /**
   * Plan's final version → relative weeks. Completed workouts contribute their
   * planned values: the history is rebuilt as it was designed, not as it was
   * run. With `keyById` the persisted ids become keys, which lets the editing
   * flow map diff entries back to rows.
   */
  extractFinalVersion(
    plan: { startDate: string | null; endDate: string | null },
    workouts: ExtractableWorkout[],
    options: { keyById?: boolean } = {},
  ): RelativeWeek[] {
    if (!plan.startDate) {
      return [];
    }

    const startDate = new Date(`${plan.startDate}T00:00:00Z`);
    const totalWeeks = plan.endDate
      ? Math.max(
          1,
          Math.round((new Date(`${plan.endDate}T00:00:00Z`).getTime() - startDate.getTime()) / 86_400_000 / 7),
        )
      : Math.max(1, ...workouts.map((workout) => workout.weekNumber));

    const weekNumbers = new Set(workouts.map((workout) => workout.weekNumber));
    for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber += 1) {
      weekNumbers.add(weekNumber);
    }

    return [...weekNumbers]
      .sort((left, right) => left - right)
      .map((weekNumber) => {
        const weekWorkouts = workouts
          .filter((workout) => workout.weekNumber === weekNumber)
          .sort((left, right) =>
            left.scheduledAt.getTime() === right.scheduledAt.getTime()
              ? left.orderInWeek - right.orderInWeek
              : left.scheduledAt.getTime() - right.scheduledAt.getTime(),
          )
          .map((workout, index) => ({
            key: options.keyById && workout.id ? workout.id : `w${weekNumber}-${index + 1}`,
            dayOfWeek: this.resolveWeekdayIndex(workout.scheduledAt),
            orderInWeek: index + 1,
            type: workout.type as WorkoutView['type'],
            phase: workout.phase,
            title: this.getWorkoutTitle(workout.type as WorkoutView['type']),
            durationMinutes: workout.durationMinutes,
            distanceKm: workout.distanceKm,
            target: workout.target,
            steps: workout.steps,
          }));

        const phase = weekWorkouts[0]?.phase ?? this.resolvePhase(weekNumber, totalWeeks);
        return {
          weekNumber,
          phase,
          title: this.getWeekTitle(phase, weekNumber),
          intent: this.getWeekIntent(phase, weekNumber),
          workouts: weekWorkouts,
        };
      });
  }

  /**
   * Relative weeks → dated workouts from startDate. Week numbers are treated
   * as positions relative to `startDate` (week 1 starts on it). When the
   * plan starts mid-week, first-week sessions scheduled before the start
   * weekday move to the nearest free day of that week or are dropped.
   */
  materializeWeeks(weeks: RelativeWeek[], startDate: Date, options: MaterializeOptions = {}): MaterializeResult {
    const relocateFirstWeek = options.relocateFirstWeek ?? true;
    const start = this.toUtcMidnight(startDate);
    const startWeekday = this.resolveWeekdayIndex(start);
    const totalWeeks = weeks.length;
    const materialized: MaterializedWorkout[] = [];
    const dropped: Array<{ key: string; reason: string }> = [];

    for (const week of [...weeks].sort((left, right) => left.weekNumber - right.weekNumber)) {
      const weekStart = this.addDays(start, (week.weekNumber - 1) * 7);
      const weekDaysUsed = new Set<number>();

      const ordered = [...week.workouts].sort((left, right) =>
        left.dayOfWeek === right.dayOfWeek ? left.orderInWeek - right.orderInWeek : left.dayOfWeek - right.dayOfWeek,
      );

      for (const workout of ordered) {
        let dayOfWeek = workout.dayOfWeek;

        if (relocateFirstWeek && week.weekNumber === 1 && dayOfWeek < startWeekday) {
          const relocation = this.findRelocationDay(
            dayOfWeek,
            startWeekday,
            week.workouts.map((entry) => entry.dayOfWeek).filter((day) => day >= startWeekday),
            weekDaysUsed,
          );
          if (relocation === null) {
            dropped.push({ key: workout.key, reason: 'NO_FREE_DAY_IN_WEEK' });
            continue;
          }
          dayOfWeek = relocation;
        }

        weekDaysUsed.add(dayOfWeek);
        materialized.push({
          key: workout.key,
          weekNumber: week.weekNumber,
          scheduledAt: this.resolveWeekdayDate(weekStart, 1, dayOfWeek),
          orderInWeek: workout.orderInWeek,
          type: workout.type,
          phase: workout.phase,
          durationMinutes: workout.durationMinutes,
          distanceKm: workout.distanceKm,
          target: workout.target,
          steps: workout.steps,
        });
      }
    }

    const datedWeeks = weeks.map((week) => ({
      weekNumber: week.weekNumber,
      phase: week.phase,
      weeklyLoadTarget: week.weeklyLoadTarget ?? 0,
      title: week.title ?? this.getWeekTitle(week.phase, week.weekNumber),
      intent: week.intent ?? this.getWeekIntent(week.phase, week.weekNumber),
      workoutIds: materialized
        .filter((workout) => workout.weekNumber === week.weekNumber)
        .map((workout) => workout.key),
    }));

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(this.addDays(start, totalWeeks * 7 - 1)),
      totalWeeks,
      weeks: datedWeeks,
      workouts: materialized,
      dropped,
    };
  }

  /**
   * Re-targets workout intensities to a new threshold pace.
   * Threshold resolution: explicit value → best recent result → caller-provided
   * athlete state values. `rest` workouts stay untouched.
   */
  retargetIntensity(weeks: RelativeWeek[], metrics: AthleteMetrics): RelativeWeek[] {
    const threshold = this.resolveThresholdFromMetrics(metrics);
    if (!threshold) {
      return weeks;
    }

    return weeks.map((week) => ({
      ...week,
      workouts: week.workouts.map((workout) => {
        if (workout.type === 'rest') {
          return workout;
        }

        const paceRange = this.resolvePaceRange(workout.type, threshold);
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
  scaleVolume(
    weeks: RelativeWeek[],
    k: number,
    metrics: AthleteMetrics,
  ): { weeks: RelativeWeek[]; adjustments: PlanDiffAdjustment[] } {
    const clamped = Number(this.clamp(k, REBUILD_VOLUME_SCALE_MIN, REBUILD_VOLUME_SCALE_MAX).toFixed(3));
    const adjustments: PlanDiffAdjustment[] = [{ code: 'VOLUME_SCALED', params: { k: clamped } }];
    const longestRunCapKm =
      metrics.longestRunKm && metrics.longestRunKm > 0
        ? Math.max(metrics.longestRunKm * 1.15, metrics.longestRunKm + 3)
        : null;

    const scaled = weeks.map((week) => ({
      ...week,
      workouts: week.workouts.map((workout) => this.scaleWorkoutVolume(workout, clamped)),
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

    this.capEarlyWeeklyGrowth(scaled, adjustments);

    return { weeks: scaled, adjustments };
  }

  /**
   * Remaps workouts of weeks starting at `fromWeek` onto new training days,
   * keeping keys stable and key sessions in place: the long run goes to its
   * preferred day and intensive sessions are spread apart. When a week has
   * more sessions than days, the least valuable ones (recovery, then easy)
   * are removed with an explicit reason. `allowedDaysByWeek` narrows the days
   * of a particular week (e.g. the current week only keeps upcoming days).
   */
  remapSchedule(
    weeks: RelativeWeek[],
    schedule: { trainingDays: number[]; preferredLongRunDay?: number | null },
    fromWeek: number,
    allowedDaysByWeek: Map<number, number[]> = new Map(),
  ): RemapResult {
    const baseDays = [...new Set(schedule.trainingDays)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
    const removed: Array<{ key: string; reason: string }> = [];

    if (baseDays.length === 0) {
      return { weeks, removed };
    }

    const result = weeks.map((week) => {
      if (week.weekNumber < fromWeek) {
        return week;
      }

      const days = allowedDaysByWeek.get(week.weekNumber) ?? baseDays;
      const movable = week.workouts.filter((workout) => workout.type !== 'rest');
      const rests = week.workouts.filter((workout) => workout.type === 'rest');

      let kept = [...movable];
      while (kept.length > days.length) {
        const victimIndex = kept.findIndex((workout) => workout.type === 'recovery');
        const fallbackIndex = kept.findIndex((workout) => workout.type === 'easy');
        const removeIndex = victimIndex >= 0 ? victimIndex : fallbackIndex >= 0 ? fallbackIndex : kept.length - 1;
        const [victim] = kept.splice(removeIndex, 1);
        removed.push({ key: victim.key, reason: 'NOT_ENOUGH_TRAINING_DAYS' });
      }

      const assignments = this.assignTrainingDays(kept, days, schedule.preferredLongRunDay ?? null);
      kept = kept
        .map((workout) => ({ ...workout, dayOfWeek: assignments.get(workout.key) ?? workout.dayOfWeek }))
        .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
        .map((workout, index) => ({ ...workout, orderInWeek: index + 1 }));

      return { ...week, workouts: [...kept, ...rests] };
    });

    return { weeks: result, removed };
  }

  /**
   * Extends or shortens the plan to `newTotalWeeks`. Weeks before
   * `currentWeek` are never touched; taper and race weeks survive a
   * reduction. Extension inserts copies of the last non-taper week right
   * before the taper with volume progression of at most 5 % per week.
   * Existing workout keys stay stable; inserted copies get derived keys.
   */
  resizeToTargetDate(weeks: RelativeWeek[], currentWeek: number, newTotalWeeks: number): RelativeWeek[] {
    const currentTotal = weeks.length;
    const passedWeeks = Math.max(0, currentWeek - 1);
    const protectedTail = this.countTrailingTaperWeeks(weeks);

    if (newTotalWeeks === currentTotal) {
      return weeks;
    }

    if (newTotalWeeks > currentTotal) {
      const insertCount = newTotalWeeks - currentTotal;
      const templateIndex = this.findExtensionTemplateIndex(weeks, passedWeeks);
      if (templateIndex === null) {
        throw new Error(PLAN_RESIZE_ERROR);
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

      return this.renumberWeeks([...weeks.slice(0, templateIndex + 1), ...inserted, ...weeks.slice(templateIndex + 1)]);
    }

    const removableCount = currentTotal - newTotalWeeks;
    const removable = weeks.filter(
      (week) => week.weekNumber > passedWeeks && week.weekNumber <= currentTotal - protectedTail,
    );
    const remainingNonTaper = newTotalWeeks - protectedTail;
    if (removable.length < removableCount || remainingNonTaper < 2) {
      throw new Error(PLAN_RESIZE_ERROR);
    }

    // Remove from the end of the base/build remainder first.
    const removedWeekNumbers = new Set(removable.slice(-removableCount).map((week) => week.weekNumber));
    return this.renumberWeeks(weeks.filter((week) => !removedWeekNumbers.has(week.weekNumber)));
  }

  /**
   * Week- and workout-level diff between two relative plans. Workouts are
   * matched by key across weeks, so a session moved to another week or day
   * shows up as one `modified` entry (with `weekNumber` / `dayOfWeek`
   * fields) instead of a remove/add pair.
   */
  diffPlans(
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
          const estimate = this.estimateThresholdFromTarget(workout.type, workout.target);
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
      const fields = this.diffWorkoutFields(previous.workout, entry.workout);
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

  /**
   * Rebuilds target and steps of a workout after its type or volume changed,
   * so pace zones always match the session type. The threshold pace comes
   * from the explicit value, else is recovered from the previous target.
   */
  rebuildWorkoutTarget(input: {
    type: WorkoutView['type'];
    durationMinutes: number;
    previousType?: WorkoutView['type'] | null;
    previousTarget?: Record<string, unknown> | null;
    thresholdPaceSecondsPerKm?: number | null;
  }): { target: Record<string, unknown>; steps: Array<Record<string, unknown>> } {
    const threshold =
      input.thresholdPaceSecondsPerKm ??
      (input.previousType && input.previousTarget
        ? this.estimateThresholdFromTarget(input.previousType, input.previousTarget)
        : null);
    const target = this.buildWorkoutTarget(input.type, threshold);
    return { target, steps: this.buildWorkoutSteps(input.type, input.durationMinutes, target) };
  }

  /** Recovers the threshold pace a target was built from, if possible. */
  estimateThresholdFromTarget(type: WorkoutView['type'], target: Record<string, unknown> | null): number | null {
    const paceMin = target?.paceMinSecondsPerKm;
    if (typeof paceMin !== 'number' || paceMin <= 0) {
      return null;
    }
    const reference = this.resolvePaceRange(type, 1000).min;
    return reference > 0 ? Math.round((paceMin * 1000) / reference) : null;
  }

  /** Resolves the threshold pace used by retargetIntensity. */
  resolveThresholdFromMetrics(metrics: AthleteMetrics): number | null {
    const explicit = metrics.thresholdPaceSecondsPerKm;
    if (typeof explicit === 'number' && explicit > 0) {
      return Math.round(explicit);
    }

    const result = metrics.recentResult;
    if (result && typeof result.timeSeconds === 'number' && result.timeSeconds > 0) {
      const distanceKm = this.resolveDistanceKilometres(result.distance);
      if (distanceKm > 0) {
        return Math.round(result.timeSeconds / distanceKm);
      }
    }

    return null;
  }

  /** Exposes the pace-range resolution so services reuse the same zones. */
  resolvePaceRangeFor(
    workoutType: WorkoutView['type'],
    thresholdPaceSecondsPerKm: number | null,
  ): { min: number; max: number; zone: string } {
    return this.resolvePaceRange(workoutType, thresholdPaceSecondsPerKm);
  }

  private scaleWorkoutVolume(workout: RelativeWorkout, k: number): RelativeWorkout {
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

    const validation = this.validateWorkoutOverride({ type: workout.type, distanceKm, durationMinutes });
    if (!validation.valid) {
      return workout;
    }

    return { ...workout, distanceKm, durationMinutes };
  }

  /** Limits week-over-week growth to 10 % on the first four weeks. */
  private capEarlyWeeklyGrowth(weeks: RelativeWeek[], adjustments: PlanDiffAdjustment[]): void {
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

  /** Greedy day assignment: long run on its day, intensives spread out. */
  private assignTrainingDays(
    workouts: RelativeWorkout[],
    days: number[],
    preferredLongRunDay: number | null,
  ): Map<string, number> {
    const assignments = new Map<string, number>();
    const free = new Set(days);

    const longRun = workouts.find((workout) => workout.type === 'long_run');
    if (longRun) {
      const day =
        preferredLongRunDay !== null && free.has(preferredLongRunDay)
          ? preferredLongRunDay
          : Math.max(...free.values());
      assignments.set(longRun.key, day);
      free.delete(day);
    }

    const intensives = workouts.filter(
      (workout) => workout.type !== 'long_run' && INTENSIVE_WORKOUT_TYPES.includes(workout.type),
    );
    const others = workouts.filter(
      (workout) => workout.type !== 'long_run' && !INTENSIVE_WORKOUT_TYPES.includes(workout.type),
    );

    const assignedIntensiveDays: number[] = [];
    for (const workout of intensives) {
      const day = this.pickSpreadDay([...free], assignedIntensiveDays);
      if (day === null) {
        break;
      }
      assignments.set(workout.key, day);
      assignedIntensiveDays.push(day);
      free.delete(day);
    }

    for (const workout of others) {
      const day = [...free].sort((left, right) => left - right)[0];
      if (day === undefined) {
        break;
      }
      assignments.set(workout.key, day);
      free.delete(day);
    }

    return assignments;
  }

  /** Picks the free day with the largest gap to already-assigned intensives. */
  private pickSpreadDay(freeDays: number[], assignedIntensiveDays: number[]): number | null {
    if (freeDays.length === 0) {
      return null;
    }

    let bestDay = freeDays[0];
    let bestGap = -1;
    for (const day of freeDays) {
      const gap =
        assignedIntensiveDays.length === 0
          ? 7
          : Math.min(
              ...assignedIntensiveDays.map((assigned) =>
                Math.min(Math.abs(day - assigned), 7 - Math.abs(day - assigned)),
              ),
            );
      if (gap > bestGap) {
        bestGap = gap;
        bestDay = day;
      }
    }
    return bestDay;
  }

  private findRelocationDay(
    preferredDay: number,
    startWeekday: number,
    weekDays: number[],
    usedDays: Set<number>,
  ): number | null {
    const candidates = [...new Set(weekDays)].sort(
      (left, right) => this.cyclicDistance(left, preferredDay) - this.cyclicDistance(right, preferredDay),
    );
    for (const candidate of candidates) {
      if (!usedDays.has(candidate)) {
        return candidate;
      }
    }

    // Every training day is taken: allow any free weekday on or after the
    // start weekday as a last resort (earlier days are already in the past).
    for (let candidate = startWeekday; candidate <= 6; candidate += 1) {
      if (!usedDays.has(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private cyclicDistance(left: number, right: number): number {
    const distance = Math.abs(left - right);
    return Math.min(distance, 7 - distance);
  }

  private countTrailingTaperWeeks(weeks: RelativeWeek[]): number {
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
  private findExtensionTemplateIndex(weeks: RelativeWeek[], passedWeeks: number): number | null {
    for (let index = weeks.length - 1; index >= passedWeeks; index -= 1) {
      if (!['taper', 'race'].includes(weeks[index].phase)) {
        return index;
      }
    }
    return null;
  }

  /** Renumbers weeks sequentially; workout keys stay stable. */
  private renumberWeeks(weeks: RelativeWeek[]): RelativeWeek[] {
    return weeks.map((week, index) => ({ ...week, weekNumber: index + 1 }));
  }

  private diffWorkoutFields(before: RelativeWorkout, after: RelativeWorkout): Record<string, [unknown, unknown]> {
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

  private getWeekTitle(phase: string, weekNumber: number): string {
    const p = phase.toLowerCase();
    if (p === 'base') return 'Building consistency';
    if (p === 'build') return 'Increasing training load';
    if (p === 'specific') return 'Race-specific work';
    if (p === 'peak') return 'Peak preparation';
    if (p === 'taper') return 'Reducing load';
    if (p === 'race') return 'Race week';
    if (p === 'recovery') return 'Volume recovery';
    return `Week ${weekNumber} focus`;
  }

  // The optional week number keeps the signature aligned with getWeekTitle;
  // intents today depend on the phase only.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getWeekIntent(phase: string, _weekNumber?: number): string {
    const p = phase.toLowerCase();
    if (p === 'base') return 'Establish steady running routine and comfortable easy effort aerobic base.';
    if (p === 'build') return 'Build aerobic strength while maintaining recovery between quality sessions.';
    if (p === 'specific') return 'Develop target race pace efficiency and rhythm.';
    if (p === 'peak') return 'Execute final key race simulation session before reducing volume.';
    if (p === 'taper') return 'Shed residual fatigue while preserving neural sharpness.';
    if (p === 'race') return 'Rest, hydrate, carb load and execute your goal race.';
    if (p === 'recovery') return 'Allow body to adapt to previous load while maintaining frequency.';
    return 'Focus on consistent training and proper recovery.';
  }

  private getWorkoutTitle(type: WorkoutView['type']): string {
    return type
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private toUtcMidnight(date: Date): Date {
    if (!Number.isNaN(date.getUTCFullYear())) {
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    return new Date(date);
  }

  /** Resolves the concrete date of a weekday index within a plan week. */
  resolveWeekdayDate(startDate: Date, weekNumber: number, dayOfWeek: number): Date {
    const weekStart = this.addDays(startDate, (weekNumber - 1) * 7);
    const startWeekday = this.resolveWeekdayIndex(startDate);
    const offset = (dayOfWeek - startWeekday + 7) % 7;
    return this.addDays(weekStart, offset);
  }

  /** Clamps a user-selected number of weeks into the supported range. */
  clampManualWeeks(totalWeeks: number): number {
    return Math.max(MANUAL_PLAN_MIN_WEEKS, Math.min(MANUAL_PLAN_MAX_WEEKS, totalWeeks));
  }

  /** Monday-first weekday index (0 = Monday ... 6 = Sunday). */
  private resolveWeekdayIndex(date: Date): number {
    return (date.getUTCDay() + 6) % 7;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
