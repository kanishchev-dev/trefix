import { AthleteView, GoalView, WorkoutAnalysisView, WorkoutView } from './interfaces/training-views.interface';
import {
  ATHLETE_GOAL_DISTANCES,
  MANUAL_PLAN_FOCUS_TYPES,
  MANUAL_PLAN_MAX_DISTANCE_KM,
  MANUAL_PLAN_MAX_DURATION_MINUTES,
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_DURATION_MINUTES,
  MANUAL_PLAN_MIN_WEEKS,
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

export class TrainingEngine {
  /**
   * Maps a goal type onto its default workout emphasis (PRD section 17).
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
    // Universal payload takes priority (PRD section 17: engine distinguishes
    // goal types instead of treating every goal as a generic race target).
    const universalPace = this.resolveUniversalGoalPace(goal);
    if (universalPace) {
      return universalPace;
    }

    // Legacy race columns stay supported for goals created before the
    // universal model (PRD section 26).
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
   * existing workout before calling (PRD section 14: validated user change).
   */
  validateWorkoutOverride(input: {
    type: string;
    dayOfWeek?: number;
    distanceKm?: number;
    durationMinutes?: number;
  }): { valid: true; value: { type: WorkoutView['type']; dayOfWeek?: number; distanceKm?: number; durationMinutes?: number } } | { valid: false; reason: string } {
    if (!(WORKOUT_TYPE_INTENSITY_FACTORS as Record<string, number>)[input.type]) {
      return { valid: false, reason: 'unsupported_workout_type' };
    }

    if (input.dayOfWeek !== undefined && (input.dayOfWeek < 0 || input.dayOfWeek > 6)) {
      return { valid: false, reason: 'invalid_day_of_week' };
    }

    if (
      input.distanceKm !== undefined &&
      (input.distanceKm <= 0 || input.distanceKm > MANUAL_PLAN_MAX_DISTANCE_KM)
    ) {
      return { valid: false, reason: 'invalid_distance' };
    }

    if (
      input.durationMinutes !== undefined &&
      (input.durationMinutes < MANUAL_PLAN_MIN_DURATION_MINUTES ||
        input.durationMinutes > MANUAL_PLAN_MAX_DURATION_MINUTES)
    ) {
      return { valid: false, reason: 'invalid_duration' };
    }

    return { valid: true, value: input as { type: WorkoutView['type']; dayOfWeek?: number; distanceKm?: number; durationMinutes?: number } };
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
