import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';
import { EntityAlreadyExistsException } from '@/common/exceptions/entity-already-exists.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { CoachPolicyService } from '@/modules/users/preferences/coach-policy.service';

import { calculateHrZones, heartRateRangeForZone } from './athletes/hr-zones';
import { AdaptPlanDto } from './dto/adapt-plan.dto';
import { AnalyzeWorkoutDto } from './dto/analyze-workout.dto';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateManualPlanDto, ManualPlanWeekOverrideDto, PreviewManualPlanDto } from './dto/create-manual-plan.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import {
  ManualPlanPreviewResponseDto,
  ManualPlanPreviewWeekDto,
  ManualPlanPreviewWorkoutDto,
} from './dto/manual-plan-preview-response.dto';
import { CurrentWeekContextDto, PlanOverviewResponseDto, PlanWeekDto } from './dto/plan-overview-response.dto';
import { AdaptationEvent } from './entities/adaptation-event.entity';
import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { AthleteState } from './entities/athlete-state.entity';
import { TrainingLoad } from './entities/training-load.entity';
import { TrainingPlan, TrainingPlanConfig, TrainingPlanMetricsSnapshot } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';
import { AthleteCreatedEvent } from './events/athlete-created.event';
import { AthleteUpdatedEvent } from './events/athlete-updated.event';
import { GoalCreatedEvent } from './events/goal-created.event';
import { PlanAdaptationProposedEvent, PlanAdaptedEvent } from './events/plan-adapted.event';
import { PlanMetricsEnteredEvent } from './events/plan-metrics-entered.event';
import { AthleteStateUpdatedEvent } from './events/state-updated.event';
import { WorkoutCompletedEvent } from './events/workout-completed.event';
import { deriveLegacyRaceFields, type GoalPayloadShape, mapLegacyRaceGoal, validateGoalPayload } from './goal-taxonomy';
import { ImportedWorkoutFacts } from './interfaces/imported-workout.interface';
import {
  AdaptationEventView,
  AthleteStateView,
  AthleteView,
  GoalView,
  TrainingPlanView,
  WorkoutAnalysisView,
  WorkoutView,
} from './interfaces/training-views.interface';
import { AthleteMetricsService, CurrentMetrics } from './plans/athlete-metrics.service';
import { PlanLifecycleService, PlanStartInput } from './plans/plan-lifecycle.service';
import { applyRelativeOverrides, RelativeWeekOverride } from './plans/plan-structure';
import { resolveGoalSummaryTitle, todayIsoInTz } from './plans/plan-utils';
import {
  ADAPTATION_TYPE_HEART_RATE,
  ADAPTATION_TYPE_USER_EDIT,
  ATHLETE_GOAL_STATUSES,
  IMPORTED_LONG_RUN_FACTOR,
  IMPORTED_LONG_RUN_MIN_KM,
  IMPORTED_LONG_RUN_WINDOW_DAYS,
  TRAINING_DEFAULT_AVAILABILITY,
  TRAINING_DEFAULT_DURATION_MINUTES,
  TRAINING_DEFAULT_FREQUENCY,
  TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
  TRAINING_LOAD_ALGORITHM_VERSION,
  TRAINING_WEEKDAY_ORDER,
  type WorkoutType,
} from './training.constants';
import {
  type AthleteMetrics,
  type PlanBuildResult,
  TrainingEngine,
  type TrainingStateComputation,
} from './training.engine';

/** Days a completed plan is still shown as the current one. */
const CURRENT_PLAN_COMPLETED_GRACE_DAYS = 14;

/** The parts of a manual configuration the engine generates from. */
type ManualPlanConfigInput = Pick<PreviewManualPlanDto, 'goal' | 'schedule' | 'structure'>;

interface WorkoutCompletionResult {
  workout: WorkoutView;
  analysis: WorkoutAnalysisView;
  state: AthleteStateView;
  adaptation: AdaptationEventView;
}

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectModel(AthleteGoal)
    private readonly goalModel: typeof AthleteGoal,
    @InjectModel(AthleteState)
    private readonly athleteStateModel: typeof AthleteState,
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    @InjectModel(TrainingLoad)
    private readonly trainingLoadModel: typeof TrainingLoad,
    @InjectModel(AdaptationEvent)
    private readonly adaptationEventModel: typeof AdaptationEvent,
    private readonly eventEmitter: EventEmitter2,
    private readonly trainingEngine: TrainingEngine,
    private readonly planLifecycleService: PlanLifecycleService,
    private readonly athleteMetricsService: AthleteMetricsService,
    private readonly coachPolicyService: CoachPolicyService,
  ) {}

  /** Creates an athlete profile for the authenticated user. */
  async createAthlete(actorUserId: string, dto: CreateAthleteDto): Promise<AthleteView> {
    const existingAthlete = await this.athleteModel.findOne({ where: { userId: actorUserId } });
    if (existingAthlete) {
      throw new EntityAlreadyExistsException('Athlete', 'userId', actorUserId);
    }

    const athlete = await this.athleteModel.create({
      userId: actorUserId,
      age: dto.age ?? null,
      sex: dto.sex ?? null,
      heightCm: dto.heightCm ?? null,
      weightKg: dto.weightKg ?? null,
      experienceLevel: dto.experienceLevel,
      weeklyMileageKm: dto.weeklyMileageKm ?? TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
      sessionsPerWeek: dto.sessionsPerWeek ?? TRAINING_DEFAULT_FREQUENCY,
      recentRaceResults: dto.recentRaceResults ?? [],
      preferredTrainingDays: this.normalizeDays(dto.preferredTrainingDays),
      availableTrainingDays: this.normalizeDays(dto.availableTrainingDays),
      preferredWorkoutDurationMinutes: dto.preferredWorkoutDurationMinutes ?? TRAINING_DEFAULT_DURATION_MINUTES,
    });

    this.eventEmitter.emit('training.athlete.created', new AthleteCreatedEvent(athlete.id, actorUserId));
    await this.recalculateAthleteState(athlete.id);

    return this.toAthleteView(athlete);
  }

  /** Returns the athlete profile if it belongs to the authenticated user. */
  async getAthlete(id: string, actorUserId: string): Promise<AthleteView> {
    const athlete = await this.loadAthleteOrThrow(id);
    this.ensureAthleteOwnership(athlete, actorUserId);
    return this.toAthleteView(athlete);
  }

  /** Returns the latest athlete state snapshot. */
  async getAthleteState(id: string, actorUserId: string): Promise<AthleteStateView> {
    const athlete = await this.loadAthleteOrThrow(id);
    this.ensureAthleteOwnership(athlete, actorUserId);
    return this.getLatestStateSnapshot(athlete.id, true);
  }

  /** Finds or creates an athlete profile for the user. */
  async getOrCreateAthlete(userId: string): Promise<AthleteView> {
    const athlete = await this.athleteModel.findOne({ where: { userId } });
    if (athlete) {
      return this.toAthleteView(athlete);
    }
    return this.createAthlete(userId, { experienceLevel: 'intermediate' });
  }

  /** Finds an athlete profile by owner user id. */ async findAthleteByUserId(
    userId: string,
  ): Promise<AthleteView | null> {
    const athlete = await this.athleteModel.findOne({ where: { userId } });
    return athlete ? this.toAthleteView(athlete) : null;
  }

  /** Returns the latest goal for the authenticated athlete, if any. */
  async getLatestGoalForAthlete(athleteId: string, actorUserId: string): Promise<GoalView | null> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);
    const goal = await this.getLatestGoalForAthleteEntity(athleteId);
    return goal ? this.toGoalView(goal) : null;
  }

  /**
   * Returns the plan in work for the authenticated athlete.
   * Replaces the legacy "latest by createdAt" lookup so the coach and the AI
   * always see the plan that is actually running.
   */
  async getActivePlanForAthlete(athleteId: string, actorUserId: string): Promise<TrainingPlanView | null> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const plan = await this.planModel.findOne({
      where: { athleteId, status: 'active' },
      order: [['createdAt', 'DESC']],
    });
    if (!plan) {
      return null;
    }

    const workouts = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
        ['scheduledAt', 'ASC'],
      ],
    });

    return this.toPlanView(plan, workouts);
  }

  /** Latest edits the user made to a plan; context for the coach. */
  async listRecentUserEdits(planId: string, limit = 5): Promise<AdaptationEventView[]> {
    const events = await this.adaptationEventModel.findAll({
      where: { planId, type: ADAPTATION_TYPE_USER_EDIT },
      order: [['createdAt', 'DESC']],
      limit,
    });
    return events.map((event) => this.toAdaptationEventView(event));
  }

  /** Returns recent workouts for the authenticated athlete. */
  async listRecentWorkoutsForAthlete(athleteId: string, actorUserId: string, limit = 10): Promise<WorkoutView[]> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const workouts = await this.workoutModel.findAll({
      where: { athleteId },
      order: [
        ['scheduledAt', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
    });

    return workouts.map((workout) => this.toWorkoutView(workout));
  }

  /** Returns workouts for the authenticated athlete within a date range. */
  async listWorkoutsForDateRange(
    actorUserId: string,
    fromStr?: string,
    toStr?: string,
    includeCancelled = false,
  ): Promise<WorkoutView[]> {
    const athleteView = await this.getOrCreateAthlete(actorUserId);

    const whereClause: Record<string, unknown> = { athleteId: athleteView.id };
    // Cancelled workouts (cancelled plans / moves) stay out of Today unless
    // explicitly requested for history views.
    if (!includeCancelled) {
      whereClause.status = { [Op.ne]: 'cancelled' };
    }
    if (fromStr || toStr) {
      const scheduledAtWhere: Record<symbol, Date> = {};
      if (fromStr) {
        const fromDate = new Date(fromStr);
        fromDate.setHours(0, 0, 0, 0);
        scheduledAtWhere[Op.gte] = fromDate;
      }
      if (toStr) {
        const toDate = new Date(toStr);
        toDate.setHours(23, 59, 59, 999);
        scheduledAtWhere[Op.lte] = toDate;
      }
      whereClause.scheduledAt = scheduledAtWhere;
    }

    const workouts = await this.workoutModel.findAll({
      where: whereClause,
      order: [
        ['scheduledAt', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    return workouts.map((workout) => this.toWorkoutView(workout));
  }

  /** Creates a workout (planned or directly completed) for the authenticated athlete. */
  async createWorkout(actorUserId: string, dto: CreateWorkoutDto): Promise<WorkoutView> {
    const athleteView = await this.getOrCreateAthlete(actorUserId);
    const athlete = await this.loadAthleteOrThrow(athleteView.id);

    const scheduledDate = new Date(dto.scheduledAt);
    const isCompleted = dto.status === 'completed' || dto.actualDistanceKm !== undefined;
    const status = isCompleted ? 'completed' : dto.status || 'planned';

    if (status === 'planned') {
      const now = new Date();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      if (scheduledDate <= todayEnd) {
        throw new DomainException('INVALID_DATE', 'Плановую тренировку можно добавить только на будущую дату.');
      }
    }

    const workoutType = dto.type || 'easy';
    const durationMinutes = dto.durationMinutes ?? (dto.actualDurationMinutes || 30);
    const distanceKm = dto.distanceKm ?? (dto.actualDistanceKm || 5);

    const target = {
      title: dto.title || `${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Run`,
      description: dto.description || `${distanceKm} km at target pace`,
      source: dto.source || 'manual',
    };

    const workout = await this.workoutModel.create({
      athleteId: athlete.id,
      goalId: null,
      planId: null,
      weekNumber: 1,
      scheduledAt: scheduledDate,
      type: workoutType,
      phase: 'adhoc',
      status,
      orderInWeek: 1,
      durationMinutes,
      distanceKm,
      target,
      steps: [],
      actual: null,
      analysis: null,
      completedAt: isCompleted ? new Date() : null,
      sourceProvider: dto.source || 'manual',
    });

    if (isCompleted) {
      const actualDurationMinutes = dto.actualDurationMinutes ?? durationMinutes;
      const actualDistanceKm = dto.actualDistanceKm ?? distanceKm;

      const analysisResult = this.trainingEngine.analyzeWorkout({
        plannedWorkout: this.toWorkoutView(workout),
        actualDurationMinutes,
        actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
        actualAverageHeartRate: dto.actualAverageHeartRate,
        rpe: dto.rpe,
      });

      workout.actual = {
        actualDurationMinutes,
        actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm ?? null,
        actualAverageHeartRate: dto.actualAverageHeartRate ?? null,
        rpe: dto.rpe ?? null,
        notes: dto.notes ?? null,
      };
      workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
      await workout.save();

      const loadRecord = await this.trainingLoadModel.create({
        athleteId: athlete.id,
        workoutId: workout.id,
        occurredAt: workout.completedAt ?? workout.scheduledAt,
        load: analysisResult.trainingLoad,
        intensityFactor: analysisResult.intensityFactor,
        algorithmVersion: TRAINING_LOAD_ALGORITHM_VERSION,
      });

      await this.recalculateAthleteState(athlete.id);

      this.eventEmitter.emit(
        'training.workout.completed',
        new WorkoutCompletedEvent(athlete.id, workout.id, loadRecord.load),
      );
    }

    return this.toWorkoutView(workout);
  }

  /**
   * Creates a goal linked to the authenticated athlete from the universal
   * polymorphic payload. Validation is schema-aware and
   * authoritative.
   */
  async createGoal(actorUserId: string, dto: CreateGoalDto & { athleteId: string }): Promise<GoalView> {
    const athlete = await this.loadAthleteOrThrow(dto.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const payload = dto.goal;
    this.ensureGoalPayloadValid({
      type: payload.type,
      current: payload.current,
      target: payload.target,
      description: payload.description,
    });
    const legacyFields = deriveLegacyRaceFields({
      type: payload.type,
      current: payload.current,
      target: payload.target,
    });

    const goal = await this.goalModel.create({
      athleteId: athlete.id,
      type: payload.type,
      payload: {
        current: payload.current,
        target: payload.target ?? {},
        description: payload.description,
      },
      raceDistance: legacyFields.raceDistance,
      targetTimeSeconds: legacyFields.targetTimeSeconds,
      targetDate: payload.targetDate ?? null,
      priority: payload.priority ?? 5,
      status: ATHLETE_GOAL_STATUSES[0],
      notes: dto.notes ?? null,
    });

    this.eventEmitter.emit('training.goal.created', new GoalCreatedEvent(athlete.id, goal.id));
    return this.toGoalView(goal);
  }

  /** Returns a goal if it belongs to the authenticated user. */
  async getGoal(id: string, actorUserId: string): Promise<GoalView> {
    const goal = await this.loadGoalOrThrow(id);
    const athlete = await this.loadAthleteOrThrow(goal.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);
    return this.toGoalView(goal);
  }

  /**
   * Generates a plan for an existing goal (AI flow). The plan is stored as a
   * draft, or created and started in one transaction; see `resolveStart` for
   * the deprecated no-option behavior.
   */
  async createPlan(actorUserId: string, dto: CreatePlanDto): Promise<TrainingPlanView> {
    const athlete = await this.loadAthleteOrThrow(dto.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const goal = await this.loadGoalOrThrow(dto.goalId);
    if (goal.athleteId !== athlete.id) {
      throw new EntityNotFoundException('Goal', dto.goalId);
    }

    const state = this.withMetrics(
      this.toStateComputation(await this.getLatestStateSnapshot(athlete.id, true)),
      dto.metrics,
    );
    const athleteView = {
      ...this.toAthleteView(athlete),
      sessionsPerWeek: dto.targetTrainingFrequency ?? athlete.sessionsPerWeek,
      weeklyMileageKm: dto.metrics?.weeklyMileageKm ?? athlete.weeklyMileageKm,
    };
    const generated = this.trainingEngine.generatePlan(
      athleteView,
      this.toGoalView(goal),
      state,
      dto.startDate ? new Date(dto.startDate) : new Date(),
    );

    const metricsSnapshot = await this.buildMetricsSnapshot(athlete.id, dto.metrics);
    const { start, legacy } = this.resolveStart(dto);
    const plan = await this.planLifecycleService.createPlan(
      {
        athleteId: athlete.id,
        name: dto.name ?? resolveGoalSummaryTitle(this.toGoalView(goal)),
        notes: dto.notes ?? null,
        config: this.buildPlanConfig(goal, dto.scheduleSnapshot, {
          totalWeeks: generated.weeks.length,
          sessionsPerWeek: dto.targetTrainingFrequency ?? generated.trainingFrequency,
          ...(dto.structureSnapshot ?? {}),
        }),
        creationSource: 'ai',
        trainingFrequency: dto.targetTrainingFrequency ?? generated.trainingFrequency,
        weeklyTargetKm: generated.weeklyTargetKm,
        weeks: this.trainingEngine.toRelativeWeeks(generated),
        metricsSnapshot,
      },
      start,
      { existingGoalId: goal.id, metrics: metricsSnapshot, clampPastStartDate: legacy },
    );

    return this.toPlanViewWithWorkouts(plan);
  }

  /**
   * Engine generation from a manual configuration. User-entered metrics take
   * precedence over the stored athlete state (threshold pace, volume).
   */
  async generateFromConfig(
    athleteId: string,
    input: ManualPlanConfigInput & { metrics?: AthleteMetrics | null; startDate?: string },
  ): Promise<PlanBuildResult> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    this.ensureManualScheduleConsistency(input);

    const goal = this.buildManualGoalView(athlete.id, input);
    const athleteView = {
      ...this.applyManualScheduleToAthlete(athlete, input),
      weeklyMileageKm: input.metrics?.weeklyMileageKm ?? athlete.weeklyMileageKm,
    };
    const state = this.withMetrics(
      this.toStateComputation(await this.getLatestStateSnapshot(athlete.id, true)),
      input.metrics,
    );

    return this.trainingEngine.generatePlan(
      athleteView,
      goal,
      state,
      input.startDate ? new Date(input.startDate) : new Date(),
      {
        totalWeeks: input.structure.totalWeeks,
        preferredLongRunDay: input.schedule.preferredLongRunDay,
        focus: input.structure.focus,
      },
    );
  }

  /** Non-persisted manual plan preview with start options for the confirmation sheet. */
  async previewManualPlan(actorUserId: string, dto: PreviewManualPlanDto): Promise<ManualPlanPreviewResponseDto> {
    const athlete = await this.loadAthleteOrThrow((await this.getOrCreateAthlete(actorUserId)).id);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const generated = await this.generateFromConfig(athlete.id, dto);
    const preview = this.toManualPreview(generated);
    preview.startOptions = await this.planLifecycleService.buildStartOptions({
      athleteId: athlete.id,
      totalWeeks: generated.weeks.length,
      targetDate: dto.goal.targetDate ?? null,
      timezone: dto.timezone,
    });
    return preview;
  }

  /**
   * Creates a plan from the manual configuration with the edits the user
   * made on the preview. Saved as a draft, or created and started in one
   * transaction; see `resolveStart` for the deprecated no-option behavior.
   */
  async createManualPlan(actorUserId: string, dto: CreateManualPlanDto): Promise<TrainingPlanView> {
    const athlete = await this.loadAthleteOrThrow((await this.getOrCreateAthlete(actorUserId)).id);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const goalPayload = this.normalizeManualGoalPayload(dto.goal);
    this.ensureGoalPayloadValid(goalPayload);
    const generated = await this.generateFromConfig(athlete.id, dto);
    const metricsSnapshot = await this.buildMetricsSnapshot(athlete.id, dto.metrics);

    const weeks = applyRelativeOverrides(
      this.trainingEngine,
      this.trainingEngine.toRelativeWeeks(generated),
      this.toRelativeOverrides(dto.weekOverrides ?? []),
      {
        errorCode: 'MANUAL_PLAN_WORKOUT_INVALID',
        thresholdPaceSecondsPerKm: metricsSnapshot.thresholdPaceSecondsPerKm ?? null,
      },
    );

    // The user's schedule preferences drive future generations.
    athlete.availableTrainingDays = this.normalizeDays(
      dto.schedule.trainingDays.map((dayIndex) => TRAINING_WEEKDAY_ORDER[dayIndex]).filter(Boolean),
    );
    if (dto.schedule.workoutDurationMinutes) {
      athlete.preferredWorkoutDurationMinutes = dto.schedule.workoutDurationMinutes;
    }
    athlete.sessionsPerWeek = dto.structure.sessionsPerWeek;
    await athlete.save();
    this.eventEmitter.emit('training.athlete.updated', new AthleteUpdatedEvent(athlete.id, actorUserId));

    const { start, legacy } = this.resolveStart(dto);
    const plan = await this.planLifecycleService.createPlan(
      {
        athleteId: athlete.id,
        name: dto.name ?? resolveGoalSummaryTitle(this.buildManualGoalView(athlete.id, dto)),
        notes: dto.notes ?? null,
        config: {
          goal: {
            type: goalPayload.type,
            current: goalPayload.current ?? null,
            target: goalPayload.target ?? null,
            description: goalPayload.description ?? null,
            targetDate: dto.goal.targetDate ?? null,
            priority: dto.goal.priority ?? 5,
          },
          schedule: {
            trainingDays: dto.schedule.trainingDays,
            preferredLongRunDay: dto.schedule.preferredLongRunDay ?? null,
            workoutDurationMinutes: dto.schedule.workoutDurationMinutes ?? null,
          },
          structure: {
            totalWeeks: dto.structure.totalWeeks,
            sessionsPerWeek: dto.structure.sessionsPerWeek,
            focus: dto.structure.focus ?? [],
          },
        },
        creationSource: 'manual',
        trainingFrequency: dto.structure.sessionsPerWeek,
        weeklyTargetKm: generated.weeklyTargetKm,
        weeks,
        metricsSnapshot,
      },
      start,
      { metrics: metricsSnapshot, clampPastStartDate: legacy },
    );

    return this.toPlanViewWithWorkouts(plan);
  }

  /**
   * Save mode of a create request: a draft, an explicit start, or — for
   * clients built before plans could be saved without starting — an
   * immediate start that replaces the active plan (deprecated).
   */
  private resolveStart(dto: { saveAsDraft?: boolean; start?: PlanStartInput; startDate?: string }): {
    start: PlanStartInput | null;
    legacy: boolean;
  } {
    if (dto.saveAsDraft) {
      return { start: null, legacy: false };
    }
    if (dto.start) {
      return { start: dto.start, legacy: false };
    }
    return {
      start: { startDate: (dto.startDate ?? new Date().toISOString()).slice(0, 10), replaceActive: true },
      legacy: true,
    };
  }

  /** Preview ids are `{week}-{order}`; relative keys are `w{week}-{order}`. */
  private toRelativeOverrides(overrides: ManualPlanWeekOverrideDto[]): RelativeWeekOverride[] {
    const toKey = (id: string): string => `w${id}`;
    return overrides.map((override) => ({
      weekNumber: override.weekNumber,
      removedWorkoutKeys: (override.removedWorkoutIds ?? []).map(toKey),
      workoutOverrides: (override.workoutOverrides ?? []).map((change) => ({
        key: toKey(change.id),
        type: change.type,
        dayOfWeek: change.dayOfWeek,
        distanceKm: change.distanceKm,
        durationMinutes: change.durationMinutes,
      })),
      newWorkouts: override.newWorkouts ?? [],
    }));
  }

  private async toPlanViewWithWorkouts(plan: TrainingPlan): Promise<TrainingPlanView> {
    const workouts =
      plan.status === 'draft'
        ? []
        : await this.workoutModel.findAll({
            where: { planId: plan.id },
            order: [
              ['weekNumber', 'ASC'],
              ['orderInWeek', 'ASC'],
            ],
          });
    return this.toPlanView(plan, workouts);
  }

  /** User-entered metrics override the athlete state used for generation. */
  private withMetrics(state: TrainingStateComputation, metrics?: AthleteMetrics | null): TrainingStateComputation {
    if (!metrics) {
      return state;
    }
    return {
      ...state,
      thresholdPaceSecondsPerKm:
        this.trainingEngine.resolveThresholdFromMetrics(metrics) ?? state.thresholdPaceSecondsPerKm,
      thresholdHeartRate: metrics.thresholdHeartRate ?? state.thresholdHeartRate,
    };
  }

  /** Metrics snapshot: user input merged over the current estimate. */
  private async buildMetricsSnapshot(
    athleteId: string,
    metrics?: AthleteMetrics | null,
  ): Promise<TrainingPlanMetricsSnapshot> {
    const snapshot = await this.planLifecycleService.captureMetricsSnapshot(athleteId);
    if (!metrics) {
      return snapshot;
    }

    const violations = this.athleteMetricsService.validateMetrics(metrics);
    if (violations.length > 0) {
      throw new DomainException('PLAN_METRICS_INVALID', `Invalid metrics: ${violations.join(', ')}`, 400);
    }

    const provided = Object.fromEntries(
      Object.entries(metrics).filter(([, value]) => value !== null && value !== undefined),
    );
    this.eventEmitter.emit('training.plan.metrics_entered', new PlanMetricsEnteredEvent(athleteId, metrics));
    return { ...snapshot, ...provided, capturedAt: new Date().toISOString(), source: 'user_input' };
  }

  /** Plan config snapshot from a goal entity. */
  private buildPlanConfig(
    goal: AthleteGoal,
    scheduleSnapshot?: Record<string, unknown>,
    structureSnapshot?: Record<string, unknown>,
  ): TrainingPlanConfig {
    return {
      goal: {
        type: goal.type,
        current: goal.payload?.current ?? null,
        target: goal.payload?.target ?? null,
        description: goal.payload?.description ?? null,
        targetDate: goal.targetDate ?? null,
        priority: goal.priority,
      },
      schedule: scheduleSnapshot ?? {},
      structure: structureSnapshot ?? {},
    };
  }

  /** Sessions per week must not exceed the number of selected training days. */
  private ensureManualScheduleConsistency(input: ManualPlanConfigInput): void {
    if (input.structure.sessionsPerWeek > input.schedule.trainingDays.length) {
      throw new DomainException(
        'MANUAL_PLAN_CONFIG_INVALID',
        `sessionsPerWeek (${input.structure.sessionsPerWeek}) cannot exceed the number of training days (${input.schedule.trainingDays.length})`,
        400,
      );
    }
  }

  /**
   * Normalises a manual plan goal DTO into the universal payload shape.
   * Legacy flat race fields (raceDistance / targetTimeSeconds) are mapped onto
   * the universal model; universal fields win when both are provided.
   */
  private normalizeManualGoalPayload(dtoGoal: ManualPlanConfigInput['goal']): GoalPayloadShape & {
    targetDate?: string;
  } {
    const hasUniversalType = Boolean(dtoGoal.type);
    if (hasUniversalType) {
      return {
        type: dtoGoal.type!,
        current: dtoGoal.current ?? undefined,
        target: dtoGoal.target ?? undefined,
        description: dtoGoal.description ?? undefined,
        targetDate: dtoGoal.targetDate,
      };
    }

    // Legacy flat race payload kept for older clients.
    const legacy = mapLegacyRaceGoal(dtoGoal.raceDistance ?? 'just_running', dtoGoal.targetTimeSeconds ?? null);
    return {
      type: legacy.type,
      target: legacy.target,
      targetDate: dtoGoal.targetDate,
    };
  }

  /** Validates the universal goal payload authoritatively. */
  private ensureGoalPayloadValid(goal: GoalPayloadShape): void {
    const result = validateGoalPayload(goal);
    if (result.valid) {
      return;
    }

    throw new DomainException(
      `GOAL_${result.code}`,
      `Goal configuration invalid: ${result.code}${result.field ? ` (${result.field})` : ''}`,
      400,
    );
  }

  /** Builds an in-memory goal view for preview without persisting anything. */
  private buildManualGoalView(athleteId: string, dto: ManualPlanConfigInput): GoalView {
    const payload = this.normalizeManualGoalPayload(dto.goal);
    this.ensureGoalPayloadValid(payload);

    const legacyFields = deriveLegacyRaceFields(payload);

    return {
      id: 'preview-goal',
      athleteId,
      type: payload.type,
      payload: {
        current: payload.current ?? undefined,
        target: payload.target ?? {},
        description: payload.description ?? undefined,
      },
      raceDistance: legacyFields.raceDistance,
      targetTimeSeconds: legacyFields.targetTimeSeconds,
      targetDate: dto.goal.targetDate ?? this.addDaysToIsoDate(new Date(), 84),
      priority: 5,
      status: ATHLETE_GOAL_STATUSES[0],
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /** Derives the athlete view used by the engine from the user's manual schedule. */
  private applyManualScheduleToAthlete(athlete: Athlete, dto: ManualPlanConfigInput): AthleteView {
    const trainingDays =
      dto.schedule.trainingDays.length > 0
        ? dto.schedule.trainingDays
            .map((dayIndex) => TRAINING_WEEKDAY_ORDER[dayIndex])
            .filter((day): day is (typeof TRAINING_WEEKDAY_ORDER)[number] => Boolean(day))
        : [...TRAINING_DEFAULT_AVAILABILITY];

    return {
      ...this.toAthleteView(athlete),
      sessionsPerWeek: dto.structure.sessionsPerWeek,
      availableTrainingDays: trainingDays,
      preferredWorkoutDurationMinutes: dto.schedule.workoutDurationMinutes ?? athlete.preferredWorkoutDurationMinutes,
    };
  }

  /** Maps an engine build result into the preview DTO. */
  private toManualPreview(generatedPlan: {
    startDate: string;
    endDate: string;
    trainingFrequency: number;
    weeklyTargetKm: number;
    weeks: Array<Record<string, unknown>>;
    workouts: Array<{
      type: Workout['type'];
      phase: string;
      weekNumber: number;
      scheduledAt: Date;
      orderInWeek: number;
      durationMinutes: number;
      distanceKm: number;
      target: Record<string, unknown>;
      steps: Array<Record<string, unknown>>;
    }>;
  }): ManualPlanPreviewResponseDto {
    const weeks: ManualPlanPreviewWeekDto[] = generatedPlan.weeks.map((week) => {
      const weekNumber = Number(week.weekNumber);
      const phase = String(week.phase || 'base');
      const weekWorkouts = generatedPlan.workouts.filter((workout) => workout.weekNumber === weekNumber);

      const workoutDtos: ManualPlanPreviewWorkoutDto[] = weekWorkouts.map((workout) => ({
        id: `${workout.weekNumber}-${workout.orderInWeek}`,
        type: workout.type,
        phase: workout.phase,
        weekNumber: workout.weekNumber,
        dayOfWeek: this.resolveDayOfWeekIndex(workout.scheduledAt),
        scheduledAt: this.toIsoDate(workout.scheduledAt),
        orderInWeek: workout.orderInWeek,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: workout.target,
        steps: workout.steps,
      }));

      return {
        weekNumber,
        phase: phase.toUpperCase(),
        title: this.getWeekTitle(phase, weekNumber),
        plannedWorkoutsCount: weekWorkouts.length,
        plannedDistance: Math.round(weekWorkouts.reduce((sum, workout) => sum + workout.distanceKm, 0)),
        plannedLoad: Math.round(Number(week.weeklyLoadTarget || 0)),
        workouts: workoutDtos,
      };
    });

    return {
      startDate: generatedPlan.startDate,
      endDate: generatedPlan.endDate,
      totalWeeks: generatedPlan.weeks.length,
      trainingFrequency: generatedPlan.trainingFrequency,
      weeklyTargetKm: generatedPlan.weeklyTargetKm,
      weeks,
    };
  }

  private resolveDayOfWeekIndex(date: Date): number {
    // Convert JS Sunday-first getDay() into the Monday-first index used by the app.
    return (date.getUTCDay() + 6) % 7;
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private addDaysToIsoDate(date: Date, days: number): string {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
  }

  /** Returns a training plan with its scheduled workouts. */
  async getPlan(id: string, actorUserId: string): Promise<TrainingPlanView> {
    const plan = await this.loadPlanOrThrow(id);
    const athlete = await this.loadAthleteOrThrow(plan.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const workouts = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
        ['scheduledAt', 'ASC'],
      ],
    });

    return this.toPlanView(plan, workouts);
  }

  /** Returns a complete overview of the training plan for the screen. */
  async getPlanOverview(id: string, actorUserId: string): Promise<PlanOverviewResponseDto> {
    let plan: TrainingPlan | null = null;
    if (id === 'current') {
      const athleteId = (await this.getOrCreateAthlete(actorUserId)).id;
      // `current` is the active plan, or a recently completed one so the user
      // still sees the result; drafts and cancelled plans are never current.
      plan = await this.planModel.findOne({
        where: { athleteId, status: 'active' },
        order: [['createdAt', 'DESC']],
      });

      if (!plan) {
        const twoWeeksAgo = new Date(Date.now() - CURRENT_PLAN_COMPLETED_GRACE_DAYS * 86_400_000)
          .toISOString()
          .slice(0, 10);
        plan = await this.planModel.findOne({
          where: {
            athleteId,
            status: 'completed',
            endDate: { [Op.gte]: twoWeeksAgo },
          },
          order: [['endDate', 'DESC']],
        });
      }
    } else {
      plan = await this.loadPlanOrThrow(id);
    }

    if (!plan) {
      throw new EntityNotFoundException('TrainingPlan', id);
    }

    const athlete = await this.loadAthleteOrThrow(plan.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    await this.planLifecycleService.completeIfEnded(plan);

    const goal = plan.goalId ? await this.loadGoalOrThrow(plan.goalId) : null;
    const workouts = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
      ],
    });

    const adaptations = await this.adaptationEventModel.findAll({
      where: { planId: plan.id },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const startDate = plan.startDate ? new Date(plan.startDate) : new Date();
    const now = new Date();
    let currentWeekNumber = 0;

    if (now >= startDate) {
      const diffTime = now.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      currentWeekNumber = Math.max(1, Math.min(plan.weeks.length, Math.floor(diffDays / 7) + 1));
    }

    const weeks: PlanWeekDto[] = plan.weeks.map((week: Record<string, unknown>) => {
      const weekNumber = Number(week.weekNumber);
      const weekWorkouts = workouts.filter((w) => w.weekNumber === weekNumber);
      const totalDistance = weekWorkouts.reduce((sum, w) => sum + w.distanceKm, 0);

      let status: 'completed' | 'current' | 'upcoming';
      if (currentWeekNumber === 0) {
        status = 'upcoming';
      } else if (weekNumber < currentWeekNumber) {
        status = 'completed';
      } else if (weekNumber === currentWeekNumber) {
        status = 'current';
      } else {
        status = 'upcoming';
      }

      const phase = String(week.phase ?? 'base');

      return {
        id: `week-${plan.id}-${weekNumber}`,
        weekNumber,
        phase: phase.toUpperCase(),
        title: this.getWeekTitle(phase, weekNumber),
        status,
        plannedWorkoutsCount: weekWorkouts.length,
        plannedDistance: Math.round(totalDistance),
        plannedLoad: Math.round(Number(week.weeklyLoadTarget ?? 0)),
        summaryText: `${weekWorkouts.length} workouts · ${Math.round(totalDistance)} km`,
        intent: this.getWeekIntent(phase),
        keySessions: weekWorkouts
          .filter((w) => ['interval', 'threshold', 'tempo', 'long_run'].includes(w.type))
          .map((w) => `${w.type.charAt(0).toUpperCase() + w.type.slice(1)} ${Math.round(w.distanceKm)}km`),
      };
    });

    const currentPhase = weeks.find((w) => w.status === 'current')?.phase || weeks[0]?.phase || 'BASE';
    const currentWeekContext: CurrentWeekContextDto | undefined =
      currentWeekNumber > 0 && currentWeekNumber <= weeks.length
        ? {
            title: weeks[currentWeekNumber - 1].title,
            description: weeks[currentWeekNumber - 1].intent,
            focusItems: weeks[currentWeekNumber - 1].keySessions,
          }
        : undefined;

    const planStatusMap: Record<string, 'not_started' | 'active' | 'completed' | 'cancelled'> = {
      draft: 'not_started',
      active: 'active',
      completed: 'completed',
      paused: 'active',
      cancelled: 'cancelled',
    };

    // Universal goals must not assume race distance/time:
    // the summary derives from the goal type, custom goals keep user text.
    const goalTitle = goal ? this.resolveGoalSummaryTitle(goal) : undefined;

    return {
      plan: {
        id: plan.id,
        name: plan.name || goalTitle || 'Training Plan',
        goal: {
          title: goalTitle,
          distance: goal?.raceDistance || 'Unknown',
          targetTime: goal?.targetTimeSeconds
            ? `${Math.floor(goal.targetTimeSeconds / 3600)}h ${Math.floor((goal.targetTimeSeconds % 3600) / 60)}m`
            : undefined,
          targetDate: goal?.targetDate ?? undefined,
        },
        status: planStatusMap[plan.status] || 'active',
        currentWeek: currentWeekNumber,
        totalWeeks: plan.weeks.length,
        progress: currentWeekNumber > 0 ? currentWeekNumber / plan.weeks.length : 0,
        currentPhase,
        startDate: plan.startDate ?? undefined,
        notes: plan.notes,
        version: plan.version,
        config: { ...plan.config },
      },
      weeks,
      currentWeekContext,
      adaptations: adaptations.map((a) => ({
        id: a.id,
        weekNumber: workouts.find((w) => w.id === a.workoutId)?.weekNumber,
        type: a.type,
        title: this.getAdaptationTitle(a.type),
        description: a.reason,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /** Human-readable goal summary used by the plan overview. */
  private resolveGoalSummaryTitle(goal: GoalView | AthleteGoal): string {
    if (goal.type === 'custom' && goal.payload?.description) {
      return goal.payload.description;
    }

    const target = goal.payload?.target ?? {};
    const formatTime = (secs: number): string => {
      const mins = Math.floor(secs / 60);
      const s = Math.abs(Math.round(secs % 60));
      return `${mins}:${String(s).padStart(2, '0')}`;
    };

    const distanceMeters = typeof target.distanceMeters === 'number' ? target.distanceMeters : null;
    const finishTimeSec = typeof target.finishTimeSec === 'number' ? target.finishTimeSec : null;
    if (distanceMeters) {
      const distanceKm = Math.round(distanceMeters / 100) / 10;
      return finishTimeSec ? `${distanceKm} km · ${formatTime(finishTimeSec)}` : `${distanceKm} km goal`;
    }

    const runsPerWeek = typeof target.runsPerWeek === 'number' ? target.runsPerWeek : null;
    if (runsPerWeek) {
      return `${runsPerWeek} runs/week`;
    }

    const weightKg = typeof target.weightKg === 'number' ? target.weightKg : null;
    if (weightKg) {
      return `${weightKg} kg goal`;
    }

    return goal.type
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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

  private getWeekIntent(phase: string): string {
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

  private getAdaptationTitle(type: string): string {
    if (type === 'ADD_RECOVERY') return 'Recovery added';
    if (type === 'REDUCE_INTENSITY') return 'Intensity reduced';
    if (type === 'REDUCE_VOLUME') return 'Volume reduced';
    if (type === 'MOVE') return 'Workout moved';
    if (type === 'REPLACE') return 'Workout replaced';
    if (type === 'REGENERATE_PLAN') return 'Plan adjusted';
    return 'Plan adaptation';
  }

  /**
   * Regenerates the future part of an existing training plan.
   * Deprecated: only active engine-created plans support it;
   * manual plans must use the editing endpoints instead.
   */
  async regeneratePlan(actorUserId: string, planId: string, startDate?: string): Promise<TrainingPlanView> {
    const plan = await this.loadPlanOrThrow(planId);
    const athlete = await this.loadAthleteOrThrow(plan.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    if (plan.status !== 'active') {
      throw new DomainException('PLAN_INVALID_STATUS', 'Only the active plan can be regenerated', 409);
    }
    if (plan.creationSource === 'manual') {
      throw new DomainException(
        'PLAN_REGENERATE_UNSUPPORTED',
        'Manual plans are edited with the plan editing endpoints instead',
        409,
      );
    }

    // Regeneration rewrites every workout; once training has history it would
    // destroy it, so started plans are edited with the change endpoints.
    const completedCount = await this.workoutModel.count({ where: { planId: plan.id, status: 'completed' } });
    if (completedCount > 0) {
      throw new DomainException(
        'PLAN_REGENERATE_UNSUPPORTED',
        'The plan already has completed workouts; use the plan editing endpoints instead',
        409,
      );
    }

    if (!plan.goalId) {
      throw new EntityNotFoundException('Goal', plan.id);
    }

    const goal = await this.loadGoalOrThrow(plan.goalId);
    const state = await this.getLatestStateSnapshot(athlete.id, true);
    const athleteView = {
      ...this.toAthleteView(athlete),
      sessionsPerWeek: plan.trainingFrequency,
    };
    const generatedPlan = this.trainingEngine.generatePlan(
      athleteView,
      this.toGoalView(goal),
      this.toStateComputation(state),
      startDate ? new Date(startDate) : new Date(plan.startDate!),
    );

    await this.workoutModel.destroy({ where: { planId: plan.id } });
    const workouts = await this.persistGeneratedWorkouts(plan, athlete, goal, generatedPlan.workouts);

    plan.startDate = generatedPlan.startDate;
    plan.endDate = generatedPlan.endDate;
    plan.trainingFrequency = generatedPlan.trainingFrequency;
    plan.weeklyTargetKm = generatedPlan.weeklyTargetKm;
    plan.weeks = generatedPlan.weeks;
    await plan.save();
    await this.updatePlanWeeksWithWorkoutIds(plan, generatedPlan.weeks, workouts);

    return this.toPlanView(plan, workouts);
  }

  /** Current metrics estimate for the plan creation prefill. */
  async getCurrentMetrics(actorUserId: string): Promise<CurrentMetrics> {
    const athlete = await this.getOrCreateAthlete(actorUserId);
    return this.athleteMetricsService.currentMetrics(athlete.id);
  }

  /** Returns a workout if it belongs to the authenticated user. */
  async getWorkout(id: string, actorUserId: string): Promise<WorkoutView> {
    const workout = await this.loadWorkoutOrThrow(id);
    const athlete = await this.loadAthleteOrThrow(workout.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);
    return this.toWorkoutView(workout);
  }

  /** Analyzes a completed workout against its planned target. */
  async analyzeWorkout(actorUserId: string, dto: AnalyzeWorkoutDto): Promise<WorkoutAnalysisView> {
    const workout = await this.loadWorkoutOrThrow(dto.workoutId);
    const athlete = await this.loadAthleteOrThrow(workout.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const analysis = this.trainingEngine.analyzeWorkout({
      plannedWorkout: this.toWorkoutView(workout),
      actualDurationMinutes: dto.actualDurationMinutes,
      actualDistanceKm: dto.actualDistanceKm,
      actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
      actualAverageHeartRate: dto.actualAverageHeartRate,
      rpe: dto.rpe,
    });

    return analysis.analysis;
  }

  /**
   * Marks the fact of a completed workout. Allowed for
   * planned workouts in any plan status — including history plans — because
   * this records a fact instead of editing the plan. Cancelled workouts of a
   * cancelled plan stay blocked: that run is logged as a separate workout.
   */
  async completeWorkout(
    actorUserId: string,
    workoutId: string,
    dto: CompleteWorkoutDto,
  ): Promise<WorkoutCompletionResult> {
    const workout = await this.loadWorkoutOrThrow(workoutId);
    const athlete = await this.loadAthleteOrThrow(workout.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    if (workout.status === 'cancelled') {
      throw new DomainException(
        'WORKOUT_CANCELLED',
        'A cancelled workout cannot be marked as completed; log it as a separate workout instead',
        409,
      );
    }
    if (workout.status === 'skipped') {
      throw new DomainException('WORKOUT_LOCKED', 'A skipped workout cannot be marked as completed', 409);
    }

    if (workout.status === 'completed' && workout.analysis) {
      const state = await this.getLatestStateSnapshot(athlete.id, true);
      const existingAnalysis = this.toWorkoutAnalysisView(workout.analysis);
      const adaptation =
        (await this.getLatestAdaptationEventForWorkout(workout.id)) ??
        this.buildNoopAdaptationView(athlete.id, workout);

      return {
        workout: this.toWorkoutView(workout),
        analysis: existingAnalysis,
        state,
        adaptation,
      };
    }

    const analysisResult = this.trainingEngine.analyzeWorkout({
      plannedWorkout: this.toWorkoutView(workout),
      actualDurationMinutes: dto.actualDurationMinutes,
      actualDistanceKm: dto.actualDistanceKm,
      actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
      actualAverageHeartRate: dto.actualAverageHeartRate,
      rpe: dto.rpe,
    });

    workout.status = 'completed';
    workout.actual = {
      actualDurationMinutes: dto.actualDurationMinutes,
      actualDistanceKm: dto.actualDistanceKm,
      actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm ?? null,
      actualAverageHeartRate: dto.actualAverageHeartRate ?? null,
      rpe: dto.rpe ?? null,
      notes: dto.notes ?? null,
    };
    workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
    workout.completedAt = new Date();
    await workout.save();

    const loadRecord = await this.trainingLoadModel.create({
      athleteId: athlete.id,
      workoutId: workout.id,
      occurredAt: workout.completedAt,
      load: analysisResult.trainingLoad,
      intensityFactor: analysisResult.intensityFactor,
      algorithmVersion: TRAINING_LOAD_ALGORITHM_VERSION,
    });

    const state = await this.recalculateAthleteState(athlete.id);
    const adaptation = await this.applyAdaptationDecision(
      athlete,
      workout,
      analysisResult.analysis,
      state,
      undefined,
      undefined,
      'automatic',
    );

    this.eventEmitter.emit(
      'training.workout.completed',
      new WorkoutCompletedEvent(athlete.id, workout.id, loadRecord.load),
    );

    return {
      workout: this.toWorkoutView(workout),
      analysis: analysisResult.analysis,
      state,
      adaptation,
    };
  }

  /**
   * Completes a planned workout with imported facts. System actor: ownership
   * is established by the integration that delivered the facts.
   */
  async completeWorkoutFromImport(workoutId: string, facts: ImportedWorkoutFacts): Promise<WorkoutView> {
    const workout = await this.loadWorkoutOrThrow(workoutId);
    const athlete = await this.loadAthleteOrThrow(workout.athleteId);
    if (workout.status !== 'planned') {
      throw new DomainException('WORKOUT_NOT_PLANNED', 'Only a planned workout can be completed by an import', 409);
    }

    const analysisResult = this.analyzeImportedFacts(workout, facts);
    workout.status = 'completed';
    workout.sourceProvider = facts.sourceProvider;
    workout.sourceActivityId = facts.sourceActivityId;
    workout.actual = this.toImportedActual(facts, null);
    workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
    workout.completedAt = facts.endedAt;
    await workout.save();

    const loadRecord = await this.upsertWorkoutLoad(athlete.id, workout, analysisResult);
    const state = await this.recalculateAthleteState(athlete.id);
    await this.applyAdaptationDecision(
      athlete,
      workout,
      analysisResult.analysis,
      state,
      undefined,
      undefined,
      'automatic',
    );

    this.eventEmitter.emit(
      'training.workout.completed',
      new WorkoutCompletedEvent(athlete.id, workout.id, loadRecord.load),
    );
    return this.toWorkoutView(workout);
  }

  /** Creates a completed ad-hoc workout from imported facts. System actor. */
  async createImportedWorkout(athleteId: string, facts: ImportedWorkoutFacts): Promise<WorkoutView> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    const type = await this.resolveImportedWorkoutType(athlete.id, facts);

    const workout = await this.workoutModel.create({
      athleteId: athlete.id,
      goalId: null,
      planId: null,
      weekNumber: 1,
      scheduledAt: facts.startedAt,
      type,
      phase: 'adhoc',
      status: 'completed',
      orderInWeek: 1,
      durationMinutes: facts.durationMinutes,
      distanceKm: facts.distanceKm,
      target: { source: facts.sourceProvider },
      steps: [],
      actual: null,
      analysis: null,
      completedAt: facts.endedAt,
      sourceProvider: facts.sourceProvider,
      sourceActivityId: facts.sourceActivityId,
    });

    const analysisResult = this.analyzeImportedFacts(workout, facts);
    workout.actual = this.toImportedActual(facts, null);
    workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
    await workout.save();

    const loadRecord = await this.upsertWorkoutLoad(athlete.id, workout, analysisResult);
    await this.recalculateAthleteState(athlete.id);

    this.eventEmitter.emit(
      'training.workout.completed',
      new WorkoutCompletedEvent(athlete.id, workout.id, loadRecord.load),
    );
    return this.toWorkoutView(workout);
  }

  /**
   * Replaces the facts of a completed workout: a provider updated the activity,
   * its sources were merged, or a manually closed workout got a device record.
   * RPE and notes entered by the user are kept. System actor.
   */
  async applyImportedFacts(workoutId: string, facts: ImportedWorkoutFacts): Promise<WorkoutView> {
    const workout = await this.loadWorkoutOrThrow(workoutId);
    if (workout.status !== 'completed') {
      throw new DomainException('WORKOUT_NOT_COMPLETED', 'Imported facts update only completed workouts', 409);
    }

    const analysisResult = this.analyzeImportedFacts(workout, facts);
    workout.sourceProvider = facts.sourceProvider;
    workout.sourceActivityId = facts.sourceActivityId;
    workout.actual = this.toImportedActual(facts, workout.actual);
    workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
    workout.completedAt = facts.endedAt;
    if (!workout.planId) {
      workout.scheduledAt = facts.startedAt;
      workout.durationMinutes = facts.durationMinutes;
      workout.distanceKm = facts.distanceKm;
    }
    await workout.save();

    await this.upsertWorkoutLoad(workout.athleteId, workout, analysisResult);
    await this.recalculateAthleteState(workout.athleteId);
    return this.toWorkoutView(workout);
  }

  /**
   * Undoes an import whose last source disappeared: a plan workout returns to
   * `planned`, an ad-hoc one is deleted. System actor.
   */
  async revertImportedWorkout(workoutId: string): Promise<'replanned' | 'deleted'> {
    const workout = await this.loadWorkoutOrThrow(workoutId);
    const athleteId = workout.athleteId;
    await this.trainingLoadModel.destroy({ where: { workoutId: workout.id } });

    let outcome: 'replanned' | 'deleted';
    if (workout.planId) {
      workout.status = 'planned';
      workout.actual = null;
      workout.analysis = null;
      workout.completedAt = null;
      workout.gearId = null;
      workout.sourceProvider = null;
      workout.sourceActivityId = null;
      await workout.save();
      outcome = 'replanned';
    } else {
      // Frees the (athlete, provider, activity) unique slot held by the soft-deleted row.
      workout.sourceActivityId = null;
      await workout.save();
      await workout.destroy();
      outcome = 'deleted';
    }

    await this.recalculateAthleteState(athleteId);
    return outcome;
  }

  private analyzeImportedFacts(
    workout: Workout,
    facts: ImportedWorkoutFacts,
  ): ReturnType<TrainingEngine['analyzeWorkout']> {
    return this.trainingEngine.analyzeWorkout({
      plannedWorkout: this.toWorkoutView(workout),
      actualDurationMinutes: facts.durationMinutes,
      actualDistanceKm: facts.distanceKm,
      actualAveragePaceSecondsPerKm: facts.averagePaceSecondsPerKm ?? undefined,
      actualAverageHeartRate: facts.averageHeartRate ?? undefined,
    });
  }

  private toImportedActual(
    facts: ImportedWorkoutFacts,
    previous: Record<string, unknown> | null,
  ): Record<string, unknown> {
    return {
      actualDurationMinutes: facts.durationMinutes,
      actualDistanceKm: facts.distanceKm,
      actualAveragePaceSecondsPerKm: facts.averagePaceSecondsPerKm,
      actualAverageHeartRate: facts.averageHeartRate,
      maxHeartRate: facts.maxHeartRate,
      cadence: facts.cadence,
      calories: facts.calories,
      elevationGainMeters: facts.elevationGainMeters,
      indoor: facts.indoor,
      rpe: previous?.rpe ?? null,
      notes: previous?.notes ?? null,
    };
  }

  private async upsertWorkoutLoad(
    athleteId: string,
    workout: Workout,
    analysisResult: { trainingLoad: number; intensityFactor: number },
  ): Promise<TrainingLoad> {
    const occurredAt = workout.completedAt ?? workout.scheduledAt;
    const existing = await this.trainingLoadModel.findOne({ where: { workoutId: workout.id } });
    if (existing) {
      existing.load = analysisResult.trainingLoad;
      existing.intensityFactor = analysisResult.intensityFactor;
      existing.occurredAt = occurredAt;
      existing.algorithmVersion = TRAINING_LOAD_ALGORITHM_VERSION;
      return existing.save();
    }
    return this.trainingLoadModel.create({
      athleteId,
      workoutId: workout.id,
      occurredAt,
      load: analysisResult.trainingLoad,
      intensityFactor: analysisResult.intensityFactor,
      algorithmVersion: TRAINING_LOAD_ALGORITHM_VERSION,
    });
  }

  /** `long_run` when the run is clearly longer than usual, otherwise `easy`; analysis refines it later. */
  private async resolveImportedWorkoutType(athleteId: string, facts: ImportedWorkoutFacts): Promise<WorkoutType> {
    const windowStart = new Date(facts.startedAt.getTime() - IMPORTED_LONG_RUN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recent = await this.workoutModel.findAll({
      where: {
        athleteId,
        status: 'completed',
        scheduledAt: { [Op.gte]: windowStart, [Op.lt]: facts.startedAt },
      },
      attributes: ['distanceKm', 'actual'],
    });
    const distances = recent
      .map((entry) => Number(entry.actual?.actualDistanceKm ?? entry.distanceKm))
      .filter((value) => Number.isFinite(value) && value > 0);
    const average = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0;
    const threshold = Math.max(IMPORTED_LONG_RUN_MIN_KM, average * IMPORTED_LONG_RUN_FACTOR);
    return facts.distanceKm >= threshold ? 'long_run' : 'easy';
  }

  /** Adaptations of the active plan waiting for the user's decision (`proposed`) or shown as advice (`suggested`). */
  async listPendingAdaptations(actorUserId: string): Promise<AdaptationEventView[]> {
    const athlete = await this.getOrCreateAthlete(actorUserId);
    const plan = await this.planModel.findOne({ where: { athleteId: athlete.id, status: 'active' } });
    if (!plan) {
      return [];
    }
    const events = await this.adaptationEventModel.findAll({
      where: { planId: plan.id, status: { [Op.in]: ['proposed', 'suggested'] } },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    return events.map((event) => this.toAdaptationEventView(event));
  }

  /**
   * Brings heart-rate targets of upcoming workouts of the active plan in line
   * with the athlete's current zones. Follows the coach adaptation mode:
   * applied at once, kept as a proposal, or only suggested.
   */
  async recalculateHeartRateTargets(athleteId: string): Promise<AdaptationEventView | null> {
    const athlete = await this.athleteModel.findByPk(athleteId);
    if (!athlete) {
      return null;
    }
    const plan = await this.planModel.findOne({ where: { athleteId, status: 'active' } });
    if (!plan) {
      return null;
    }
    const { zones } = calculateHrZones({
      method: athlete.hrZonesMethod,
      restingHeartRate: athlete.restingHeartRate,
      maxHeartRate: athlete.maxHeartRate,
      thresholdHeartRate: athlete.thresholdHeartRate,
      customUpperBounds: athlete.hrZonesCustom,
    });
    if (!zones) {
      return null;
    }

    const upcoming = await this.workoutModel.findAll({
      where: {
        planId: plan.id,
        status: 'planned',
        scheduledAt: { [Op.gte]: new Date(`${todayIsoInTz('UTC')}T00:00:00Z`) },
      },
    });
    const changes = upcoming
      .map((workout) => {
        const target = this.toRecord(workout.target);
        const range = heartRateRangeForZone(zones, target.zone, athlete.restingHeartRate);
        if (!range || (target.heartRateMinBpm === range.min && target.heartRateMaxBpm === range.max)) {
          return null;
        }
        return { workoutId: workout.id, heartRateMinBpm: range.min, heartRateMaxBpm: range.max };
      })
      .filter((change): change is NonNullable<typeof change> => change !== null);
    if (changes.length === 0) {
      return null;
    }

    const policy = await this.coachPolicyService.automaticAdaptationPolicy(athlete.userId);
    if (policy === 'skip') {
      return null;
    }
    const status = policy === 'apply' ? 'applied' : policy === 'propose' ? 'proposed' : 'suggested';
    if (status === 'applied') {
      await this.applyHeartRateChanges(plan, changes);
    }
    const event = await this.adaptationEventModel.create({
      athleteId,
      planId: plan.id,
      workoutId: null,
      type: ADAPTATION_TYPE_HEART_RATE,
      input: { zones },
      decision: { action: ADAPTATION_TYPE_HEART_RATE, changes },
      reason: 'Heart rate zones changed',
      confidence: 1,
      status,
      resolvedAt: status === 'applied' ? new Date() : null,
    });
    if (status === 'applied') {
      this.eventEmitter.emit('training.plan.adapted', new PlanAdaptedEvent(athleteId, plan.id, event.reason));
    } else {
      this.eventEmitter.emit(
        'training.plan.adaptation_proposed',
        new PlanAdaptationProposedEvent(
          athlete.userId,
          athleteId,
          plan.id,
          event.id,
          status,
          ADAPTATION_TYPE_HEART_RATE,
          changes.length,
        ),
      );
    }
    return this.toAdaptationEventView(event);
  }

  private async applyHeartRateChanges(plan: TrainingPlan, changes: Array<Record<string, unknown>>): Promise<number> {
    const byId = new Map(changes.map((change) => [String(change.workoutId), change]));
    const workouts = await this.workoutModel.findAll({
      where: {
        id: { [Op.in]: [...byId.keys()] },
        planId: plan.id,
        status: 'planned',
        scheduledAt: { [Op.gte]: new Date(`${todayIsoInTz('UTC')}T00:00:00Z`) },
      },
    });
    for (const workout of workouts) {
      const change = byId.get(workout.id);
      if (!change) continue;
      workout.target = {
        ...this.toRecord(workout.target),
        heartRateMinBpm: change.heartRateMinBpm,
        heartRateMaxBpm: change.heartRateMaxBpm,
      };
      await workout.save();
    }
    if (workouts.length > 0) {
      await this.planModel.increment('version', { where: { id: plan.id } });
    }
    return workouts.length;
  }

  /** Applies a proposed adaptation; workouts that already happened or changed status are left alone. */
  async applyProposedAdaptation(actorUserId: string, adaptationId: string): Promise<AdaptationEventView> {
    const { event, athlete, plan } = await this.loadPendingAdaptation(actorUserId, adaptationId);
    if (event.type === ADAPTATION_TYPE_HEART_RATE) {
      const hrChanges = Array.isArray(event.decision?.changes)
        ? (event.decision.changes as Array<Record<string, unknown>>)
        : [];
      await this.applyHeartRateChanges(plan, hrChanges);
      event.status = 'applied';
      event.resolvedAt = new Date();
      await event.save();
      this.eventEmitter.emit('training.plan.adapted', new PlanAdaptedEvent(athlete.id, plan.id, event.reason));
      return this.toAdaptationEventView(event);
    }
    const changes = Array.isArray(event.decision?.changes)
      ? (event.decision.changes as Array<Record<string, unknown>>)
      : [];
    const workoutIds = changes
      .map((change) => (typeof change.workoutId === 'string' ? change.workoutId : null))
      .filter((id): id is string => id !== null);
    const workouts = workoutIds.length
      ? await this.workoutModel.findAll({
          where: {
            id: { [Op.in]: workoutIds },
            planId: plan.id,
            status: 'planned',
            scheduledAt: { [Op.gte]: new Date(`${todayIsoInTz('UTC')}T00:00:00Z`) },
          },
        })
      : [];
    const state = await this.getLatestStateSnapshot(athlete.id, true);
    await this.applyWorkoutChanges(workouts, athlete, plan, state, changes);
    if (workouts.length > 0) {
      await this.planModel.increment('version', { where: { id: plan.id } });
    }
    event.status = 'applied';
    event.resolvedAt = new Date();
    await event.save();
    this.eventEmitter.emit('training.plan.adapted', new PlanAdaptedEvent(athlete.id, plan.id, event.reason));
    return this.toAdaptationEventView(event);
  }

  async dismissProposedAdaptation(actorUserId: string, adaptationId: string): Promise<AdaptationEventView> {
    const { event } = await this.loadPendingAdaptation(actorUserId, adaptationId, ['proposed', 'suggested']);
    event.status = 'dismissed';
    event.resolvedAt = new Date();
    await event.save();
    return this.toAdaptationEventView(event);
  }

  private async loadPendingAdaptation(
    actorUserId: string,
    adaptationId: string,
    allowed: string[] = ['proposed'],
  ): Promise<{ event: AdaptationEvent; athlete: Athlete; plan: TrainingPlan }> {
    const athleteView = await this.getOrCreateAthlete(actorUserId);
    const event = await this.adaptationEventModel.findOne({ where: { id: adaptationId, athleteId: athleteView.id } });
    if (!event) {
      throw new DomainException('ADAPTATION_NOT_FOUND', 'Adaptation not found', 404);
    }
    if (!allowed.includes(event.status)) {
      throw new DomainException('ADAPTATION_NOT_PROPOSED', 'This adaptation is no longer waiting for a decision', 409);
    }
    const plan = event.planId ? await this.planModel.findByPk(event.planId) : null;
    if (!plan || plan.status !== 'active') {
      throw new DomainException('ADAPTATION_NOT_PROPOSED', 'The plan of this adaptation is no longer active', 409);
    }
    const athlete = await this.loadAthleteOrThrow(athleteView.id);
    return { event, athlete, plan };
  }

  /** Applies an explicit or implicit adaptation decision to a plan. */
  async adaptPlan(actorUserId: string, dto: AdaptPlanDto): Promise<AdaptationEventView> {
    const plan = await this.loadPlanOrThrow(dto.planId);
    const athlete = await this.loadAthleteOrThrow(plan.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);
    if (plan.status !== 'active') {
      throw new DomainException('PLAN_INVALID_STATUS', 'Only the active plan can be adapted', 409);
    }

    const state = await this.getLatestStateSnapshot(athlete.id, true);
    const workouts = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
      ],
    });

    const workout = dto.workoutId
      ? await this.loadWorkoutOrThrow(dto.workoutId)
      : (workouts.find((entry) => entry.status === 'completed') ?? workouts[0]);
    if (!workout) {
      throw new EntityNotFoundException('Workout', dto.workoutId ?? plan.id);
    }

    const fallbackAnalysis = this.trainingEngine.analyzeWorkout({
      plannedWorkout: this.toWorkoutView(workout),
      actualDurationMinutes: workout.durationMinutes,
      actualDistanceKm: workout.distanceKm,
    }).analysis;

    const analysis = this.toWorkoutAnalysisView(
      workout.analysis ? this.toRecord(workout.analysis) : this.toRecord(fallbackAnalysis),
    );

    return this.applyAdaptationDecision(athlete, workout, analysis, state, dto.forcedAction, dto.reason);
  }

  private async applyAdaptationDecision(
    athlete: Athlete,
    workout: Workout,
    analysis: WorkoutAnalysisView,
    state: AthleteStateView,
    forcedAction?: string,
    reasonOverride?: string,
    origin: 'automatic' | 'explicit' = 'explicit',
  ): Promise<AdaptationEventView> {
    // Only the active plan adapts; history and drafts are never rewritten,
    // and sessions before today are locked as history.
    const workoutPlan = workout.planId ? await this.loadPlanOrThrow(workout.planId) : null;
    const plan = workoutPlan?.status === 'active' ? workoutPlan : null;
    const upcomingWorkouts = plan
      ? await this.workoutModel.findAll({
          where: {
            planId: plan.id,
            status: 'planned',
            scheduledAt: { [Op.gte]: new Date(`${todayIsoInTz('UTC')}T00:00:00Z`) },
            [Op.or]: [
              {
                weekNumber: {
                  [Op.gt]: workout.weekNumber,
                },
              },
              {
                weekNumber: workout.weekNumber,
                orderInWeek: {
                  [Op.gt]: workout.orderInWeek,
                },
              },
            ],
          },
          order: [
            ['weekNumber', 'ASC'],
            ['orderInWeek', 'ASC'],
          ],
        })
      : [];

    const planWeeks = plan ? this.toPlanWeeks(plan.weeks) : [];
    const decision = this.trainingEngine.adaptPlan(
      planWeeks,
      upcomingWorkouts.map((entry) => this.toWorkoutView(entry)),
      this.toStateComputation(state),
      analysis,
      forcedAction,
    );

    // Automatic adaptations follow the user's coach settings; explicit requests
    // (the user or the coach acting on the user's message) always apply.
    const policy =
      origin === 'automatic' && plan && decision.changes.length > 0
        ? await this.coachPolicyService.automaticAdaptationPolicy(athlete.userId)
        : 'apply';
    if (policy === 'skip') {
      return this.buildNoopAdaptationView(athlete.id, workout);
    }
    if (policy === 'propose' || policy === 'suggest') {
      const pending = await this.adaptationEventModel.create({
        athleteId: athlete.id,
        planId: plan?.id ?? null,
        workoutId: workout.id,
        type: decision.action,
        input: { state, analysis },
        decision: { action: decision.action, changes: decision.changes },
        reason: reasonOverride ?? decision.reason,
        confidence: decision.confidence,
        status: policy === 'propose' ? 'proposed' : 'suggested',
      });
      this.eventEmitter.emit(
        'training.plan.adaptation_proposed',
        new PlanAdaptationProposedEvent(
          athlete.userId,
          athlete.id,
          plan?.id ?? null,
          pending.id,
          pending.status,
          decision.action,
          decision.changes.length,
        ),
      );
      return this.toAdaptationEventView(pending);
    }

    await this.applyWorkoutChanges(upcomingWorkouts, athlete, plan, state, decision.changes);
    if (plan && decision.changes.length > 0) {
      // Adaptations change the plan too: bump the version so a pending user
      // edit based on the previous state is rejected instead of overwriting it.
      await this.planModel.increment('version', { where: { id: plan.id } });
    }

    const adaptationEvent = await this.adaptationEventModel.create({
      athleteId: athlete.id,
      planId: plan?.id ?? null,
      workoutId: workout.id,
      type: decision.action,
      input: {
        state,
        analysis,
      },
      decision: {
        action: decision.action,
        changes: decision.changes,
      },
      reason: reasonOverride ?? decision.reason,
      confidence: decision.confidence,
    });

    this.eventEmitter.emit(
      'training.plan.adapted',
      new PlanAdaptedEvent(athlete.id, plan?.id ?? workout.id, adaptationEvent.reason),
    );
    return this.toAdaptationEventView(adaptationEvent);
  }

  private async getLatestAdaptationEventForWorkout(workoutId: string): Promise<AdaptationEventView | null> {
    const adaptation = await this.adaptationEventModel.findOne({
      where: { workoutId },
      order: [['createdAt', 'DESC']],
    });

    return adaptation ? this.toAdaptationEventView(adaptation) : null;
  }

  private buildNoopAdaptationView(athleteId: string, workout: Workout): AdaptationEventView {
    return {
      id: `${workout.id}:noop`,
      athleteId,
      planId: workout.planId,
      workoutId: workout.id,
      type: 'KEEP',
      input: {},
      decision: {
        action: 'KEEP',
        changes: [],
      },
      reason: 'already_completed',
      confidence: 1,
      createdAt: new Date(),
    };
  }

  private async applyWorkoutChanges(
    workouts: Workout[],
    athlete: Athlete,
    plan: TrainingPlan | null,
    state: AthleteStateView,
    changes: Array<Record<string, unknown>>,
  ): Promise<void> {
    if (!plan || changes.length === 0) {
      return;
    }

    const goal = plan.goalId ? await this.loadGoalOrThrow(plan.goalId) : null;
    const athleteView = this.toAthleteView(athlete);
    const goalView = goal ? this.toGoalView(goal) : null;
    const stateComputation = this.toStateComputation(state);
    const planWeeks = this.toPlanWeeks(plan.weeks);

    for (const change of changes) {
      const workoutId = typeof change.workoutId === 'string' ? change.workoutId : null;
      if (!workoutId) {
        continue;
      }

      const targetWorkout = workouts.find((entry) => entry.id === workoutId);
      if (!targetWorkout) {
        continue;
      }

      if (typeof change.scheduledAt === 'string') {
        targetWorkout.scheduledAt = new Date(change.scheduledAt);
      }
      if (typeof change.type === 'string') {
        targetWorkout.type = change.type as Workout['type'];
      }
      if (typeof change.durationMinutes === 'number') {
        targetWorkout.durationMinutes = change.durationMinutes;
      }
      if (typeof change.distanceKm === 'number') {
        targetWorkout.distanceKm = change.distanceKm;
      }

      if (goalView) {
        const weekPlan = planWeeks.find((entry) => entry.weekNumber === targetWorkout.weekNumber);
        const weekLoadTarget = weekPlan?.weeklyLoadTarget ?? Math.round(plan.weeklyTargetKm);
        const rebuilt = this.trainingEngine.createWorkoutBlueprint({
          athlete: athleteView,
          goal: goalView,
          state: stateComputation,
          phase: targetWorkout.phase,
          weekNumber: targetWorkout.weekNumber,
          workoutType: targetWorkout.type,
          scheduledAt: targetWorkout.scheduledAt,
          orderInWeek: targetWorkout.orderInWeek,
          weekLoadTarget,
        });

        targetWorkout.durationMinutes = rebuilt.durationMinutes;
        targetWorkout.distanceKm = rebuilt.distanceKm;
        targetWorkout.target = rebuilt.target;
        targetWorkout.steps = rebuilt.steps;
      }

      await targetWorkout.save();
    }
  }

  private async persistGeneratedWorkouts(
    plan: TrainingPlan,
    athlete: Athlete,
    goal: AthleteGoal,
    workouts: Array<{
      type: Workout['type'];
      phase: string;
      weekNumber: number;
      scheduledAt: Date;
      orderInWeek: number;
      durationMinutes: number;
      distanceKm: number;
      target: Record<string, unknown>;
      steps: Array<Record<string, unknown>>;
    }>,
  ): Promise<Workout[]> {
    const persisted: Workout[] = [];
    const athleteView = this.toAthleteView(athlete);
    const goalView = this.toGoalView(goal);
    const state = this.toStateComputation(await this.getLatestStateSnapshot(athlete.id, true));

    for (const workout of workouts) {
      const blueprint = this.trainingEngine.createWorkoutBlueprint({
        athlete: athleteView,
        goal: goalView,
        state,
        phase: workout.phase,
        weekNumber: workout.weekNumber,
        workoutType: workout.type,
        scheduledAt: workout.scheduledAt,
        orderInWeek: workout.orderInWeek,
        weekLoadTarget: plan.weeklyTargetKm,
      });

      const created = await this.workoutModel.create({
        athleteId: athlete.id,
        goalId: goal.id,
        planId: plan.id,
        weekNumber: blueprint.weekNumber,
        scheduledAt: blueprint.scheduledAt,
        type: blueprint.type,
        phase: blueprint.phase,
        status: 'planned',
        orderInWeek: blueprint.orderInWeek,
        durationMinutes: blueprint.durationMinutes,
        distanceKm: blueprint.distanceKm,
        target: blueprint.target,
        steps: blueprint.steps,
        actual: null,
        analysis: null,
        completedAt: null,
      });

      persisted.push(created);
    }

    return persisted;
  }

  private async updatePlanWeeksWithWorkoutIds(
    plan: TrainingPlan,
    weeks: Array<Record<string, unknown>>,
    workouts: Workout[],
  ): Promise<void> {
    const updatedWeeks = weeks.map((week) => {
      const weekNumber = Number(week.weekNumber);
      const ids = workouts.filter((workout) => workout.weekNumber === weekNumber).map((workout) => workout.id);
      return {
        ...week,
        workoutIds: ids,
      };
    });

    plan.weeks = updatedWeeks;
    await plan.save();
  }

  private async recalculateAthleteState(athleteId: string): Promise<AthleteStateView> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    const goal = await this.getLatestGoalForAthleteEntity(athleteId);
    const recentLoads = await this.getRecentLoads(athleteId);
    const computation = this.trainingEngine.calculateTrainingState(
      this.toAthleteView(athlete),
      recentLoads.map((load) => ({
        load: load.load,
        occurredAt: load.occurredAt,
      })),
      goal ? this.toGoalView(goal) : null,
    );

    const state = await this.athleteStateModel.create({
      athleteId: athlete.id,
      fitness: computation.fitness,
      fatigue: computation.fatigue,
      form: computation.form,
      thresholdPaceSecondsPerKm: computation.thresholdPaceSecondsPerKm,
      thresholdHeartRate: computation.thresholdHeartRate,
      vo2max: computation.vo2max,
      weeklyLoad: computation.weeklyLoad,
      acuteLoad: computation.acuteLoad,
      chronicLoad: computation.chronicLoad,
      recoveryScore: computation.recoveryScore,
      confidence: computation.confidence,
      source: computation.source,
    });

    this.eventEmitter.emit(
      'training.state.updated',
      new AthleteStateUpdatedEvent(athlete.id, state.id, state.confidence),
    );

    return this.toStateView(state);
  }

  private async getLatestStateSnapshot(athleteId: string, createIfMissing: boolean): Promise<AthleteStateView> {
    const state = await this.athleteStateModel.findOne({
      where: { athleteId },
      order: [['createdAt', 'DESC']],
    });

    if (state) {
      return this.toStateView(state);
    }

    if (!createIfMissing) {
      throw new EntityNotFoundException('AthleteState', athleteId);
    }

    return this.recalculateAthleteState(athleteId);
  }

  private async getLatestGoalForAthleteEntity(athleteId: string): Promise<AthleteGoal | null> {
    return this.goalModel.findOne({
      where: { athleteId },
      order: [['createdAt', 'DESC']],
    });
  }

  private async getRecentLoads(athleteId: string): Promise<TrainingLoad[]> {
    return this.trainingLoadModel.findAll({
      where: { athleteId },
      order: [['occurredAt', 'DESC']],
      limit: 100,
    });
  }

  private async loadAthleteOrThrow(id: string): Promise<Athlete> {
    const athlete = await this.athleteModel.findByPk(id);
    if (!athlete) {
      throw new EntityNotFoundException('Athlete', id);
    }
    return athlete;
  }

  private async loadGoalOrThrow(id: string): Promise<AthleteGoal> {
    const goal = await this.goalModel.findByPk(id);
    if (!goal) {
      throw new EntityNotFoundException('Goal', id);
    }
    return goal;
  }

  private async loadPlanOrThrow(id: string): Promise<TrainingPlan> {
    const plan = await this.planModel.findByPk(id);
    if (!plan) {
      throw new EntityNotFoundException('TrainingPlan', id);
    }
    return plan;
  }

  private async loadWorkoutOrThrow(id: string): Promise<Workout> {
    const workout = await this.workoutModel.findByPk(id);
    if (!workout) {
      throw new EntityNotFoundException('Workout', id);
    }
    return workout;
  }

  private ensureAthleteOwnership(athlete: Athlete, actorUserId: string): void {
    if (athlete.userId !== actorUserId) {
      throw new EntityNotFoundException('Athlete', athlete.id);
    }
  }

  /** Maps the entity to its API view; shared with the athlete profile service. */
  toAthleteView(athlete: Athlete): AthleteView {
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
      recentRaceResults: this.toArrayOfRecords(athlete.recentRaceResults),
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

  /** Maps the goal entity to its API view; shared with the progress service. */
  toGoalView(goal: AthleteGoal): GoalView {
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

  private toStateView(state: AthleteState): AthleteStateView {
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

  private toStateComputation(state: AthleteStateView): TrainingStateComputation {
    return {
      fitness: state.fitness,
      fatigue: state.fatigue,
      form: state.form,
      weeklyLoad: state.weeklyLoad,
      acuteLoad: state.acuteLoad,
      chronicLoad: state.chronicLoad,
      recoveryScore: state.recoveryScore ?? 50,
      thresholdPaceSecondsPerKm: state.thresholdPaceSecondsPerKm,
      thresholdHeartRate: state.thresholdHeartRate,
      vo2max: state.vo2max,
      confidence: state.confidence,
      source: state.source,
    };
  }

  private toWorkoutView(workout: Workout): WorkoutView {
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
      target: this.toRecord(workout.target),
      steps: this.toArrayOfRecords(workout.steps),
      actual: workout.actual ? this.toRecord(workout.actual) : null,
      analysis: workout.analysis ? this.toWorkoutAnalysisView(workout.analysis) : null,
      completedAt: workout.completedAt,
      gearId: workout.gearId ?? null,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
    };
  }

  private toWorkoutAnalysisView(value: Record<string, unknown>): WorkoutAnalysisView {
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

  private toPlanView(plan: TrainingPlan, workouts: Workout[]): TrainingPlanView {
    const orderedWorkouts = workouts.map((workout) => this.toWorkoutView(workout));
    const planWeeks = this.toPlanWeeks(plan.weeks).map((week) => ({
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

  private toPlanWeeks(
    value: Array<Record<string, unknown>>,
  ): Array<{ weekNumber: number; phase: string; weeklyLoadTarget: number; workoutIds: string[] }> {
    return value.map((week) => ({
      weekNumber: Number(week.weekNumber ?? 0),
      phase: String(week.phase ?? 'base'),
      weeklyLoadTarget: Number(week.weeklyLoadTarget ?? 0),
      workoutIds: this.toArrayOfStrings(week.workoutIds),
    }));
  }

  private toAdaptationEventView(event: AdaptationEvent): AdaptationEventView {
    return {
      id: event.id,
      athleteId: event.athleteId,
      planId: event.planId,
      workoutId: event.workoutId,
      type: event.type,
      input: this.toRecord(event.input),
      decision: this.toRecord(event.decision),
      reason: event.reason,
      confidence: event.confidence,
      status: event.status ?? 'applied',
      createdAt: event.createdAt,
    };
  }

  private normalizeDays(days?: string[]): string[] {
    if (!days || days.length === 0) {
      return [...TRAINING_DEFAULT_AVAILABILITY];
    }

    return days.map((day) => day.trim().toLowerCase()).filter(Boolean);
  }

  private toArrayOfStrings(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((entry) => String(entry));
  }

  private toArrayOfRecords(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((entry) => this.toRecord(entry));
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }
}
