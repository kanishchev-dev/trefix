import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { AthleteStateService } from '../athletes/athlete-state.service';
import { AthletesService } from '../athletes/athletes.service';
import { CreateManualPlanDto, ManualPlanWeekOverrideDto, PreviewManualPlanDto } from '../dto/create-manual-plan.dto';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { ManualPlanPreviewResponseDto } from '../dto/manual-plan-preview-response.dto';
import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { TrainingPlanConfig, TrainingPlanMetricsSnapshot } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { AthleteUpdatedEvent } from '../events/athlete-updated.event';
import { PlanMetricsEnteredEvent } from '../events/plan-metrics-entered.event';
import {
  assertGoalPayloadValid,
  buildManualGoalView,
  DEFAULT_GOAL_PRIORITY,
  ManualPlanConfigInput,
  normalizeManualGoalPayload,
} from '../goals/goal-payload';
import { AthleteView, TrainingPlanView } from '../interfaces/training-views.interface';
import { TRAINING_DEFAULT_AVAILABILITY, TRAINING_WEEKDAY_ORDER } from '../training.constants';
import {
  type AthleteMetrics,
  type PlanBuildResult,
  TrainingEngine,
  type TrainingStateComputation,
} from '../training.engine';
import { TRAINING_EVENTS } from '../training.events';
import { normalizeDays, toAthleteView, toGoalView, toStateComputation } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';
import { AthleteMetricsService } from './athlete-metrics.service';
import { PlanLifecycleService } from './plan-lifecycle.service';
import type { PlanStartInput } from './plan-lifecycle.types';
import { toManualPreview } from './plan-presentation';
import { PlanQueryService } from './plan-query.service';
import { PlanStartOptionsService } from './plan-start-options.service';
import { applyRelativeOverrides, RelativeWeekOverride } from './plan-structure';

/** How a create request wants the new plan saved. */
interface ResolvedStart {
  start: PlanStartInput | null;
  /** Deprecated request without an explicit mode: start at once and replace the active plan. */
  legacy: boolean;
}

/** Plan creation from a goal (AI flow) or a manual configuration, and engine regeneration. */
@Injectable()
export class PlanGenerationService {
  constructor(
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly lookup: TrainingLookupService,
    private readonly athletes: AthletesService,
    private readonly athleteState: AthleteStateService,
    private readonly athleteMetrics: AthleteMetricsService,
    private readonly planLifecycle: PlanLifecycleService,
    private readonly startOptions: PlanStartOptionsService,
    private readonly planQuery: PlanQueryService,
    private readonly trainingEngine: TrainingEngine,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Generates a plan for an existing goal (AI flow): saved as a draft, or created and started in one transaction. */
  async createPlan(actorUserId: string, dto: CreatePlanDto): Promise<TrainingPlanView> {
    const athlete = await this.lookup.ownedAthlete(dto.athleteId, actorUserId);
    const goal = await this.lookup.goal(dto.goalId);
    if (goal.athleteId !== athlete.id) {
      throw new EntityNotFoundException('Goal', dto.goalId);
    }

    const state = this.withMetrics(toStateComputation(await this.athleteState.latest(athlete.id)), dto.metrics);
    const athleteView = {
      ...toAthleteView(athlete),
      sessionsPerWeek: dto.targetTrainingFrequency ?? athlete.sessionsPerWeek,
      weeklyMileageKm: dto.metrics?.weeklyMileageKm ?? athlete.weeklyMileageKm,
    };
    const generated = this.trainingEngine.generatePlan(
      athleteView,
      toGoalView(goal),
      state,
      dto.startDate ? new Date(dto.startDate) : new Date(),
    );

    const metricsSnapshot = await this.buildMetricsSnapshot(athlete.id, dto.metrics);
    const { start, legacy } = this.resolveStart(dto);
    const plan = await this.planLifecycle.createPlan(
      {
        athleteId: athlete.id,
        name: dto.name ?? null,
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

    return this.planQuery.planView(plan);
  }

  /** Engine generation from a manual configuration; user-entered metrics take precedence over the stored state. */
  async generateFromConfig(
    athleteId: string,
    input: ManualPlanConfigInput & { metrics?: AthleteMetrics | null; startDate?: string },
  ): Promise<PlanBuildResult> {
    const athlete = await this.lookup.athlete(athleteId);
    this.ensureManualScheduleConsistency(input);

    const goal = buildManualGoalView(athlete.id, input);
    const athleteView = {
      ...this.applyManualScheduleToAthlete(athlete, input),
      weeklyMileageKm: input.metrics?.weeklyMileageKm ?? athlete.weeklyMileageKm,
    };
    const state = this.withMetrics(toStateComputation(await this.athleteState.latest(athlete.id)), input.metrics);

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
    const athlete = await this.athletes.getOrCreateAthlete(actorUserId);
    const generated = await this.generateFromConfig(athlete.id, dto);
    const preview = toManualPreview(generated);
    preview.startOptions = await this.startOptions.buildStartOptions({
      athleteId: athlete.id,
      totalWeeks: generated.weeks.length,
      targetDate: dto.goal.targetDate ?? null,
      timezone: dto.timezone,
    });
    return preview;
  }

  /**
   * Creates a plan from the manual configuration with the edits the user made
   * on the preview: saved as a draft, or created and started in one transaction.
   */
  async createManualPlan(actorUserId: string, dto: CreateManualPlanDto): Promise<TrainingPlanView> {
    const athlete = await this.lookup.athlete((await this.athletes.getOrCreateAthlete(actorUserId)).id);

    const goalPayload = normalizeManualGoalPayload(dto.goal);
    assertGoalPayloadValid(goalPayload);
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
    athlete.availableTrainingDays = normalizeDays(
      dto.schedule.trainingDays.map((dayIndex) => TRAINING_WEEKDAY_ORDER[dayIndex]).filter(Boolean),
    );
    if (dto.schedule.workoutDurationMinutes) {
      athlete.preferredWorkoutDurationMinutes = dto.schedule.workoutDurationMinutes;
    }
    athlete.sessionsPerWeek = dto.structure.sessionsPerWeek;
    await athlete.save();
    this.eventEmitter.emit(TRAINING_EVENTS.ATHLETE_UPDATED, new AthleteUpdatedEvent(athlete.id, actorUserId));

    const { start, legacy } = this.resolveStart(dto);
    const plan = await this.planLifecycle.createPlan(
      {
        athleteId: athlete.id,
        name: dto.name ?? null,
        notes: dto.notes ?? null,
        config: {
          goal: {
            type: goalPayload.type,
            current: goalPayload.current ?? null,
            target: goalPayload.target ?? null,
            description: goalPayload.description ?? null,
            targetDate: dto.goal.targetDate ?? null,
            priority: dto.goal.priority ?? DEFAULT_GOAL_PRIORITY,
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

    return this.planQuery.planView(plan);
  }

  /** Save mode of a create request; see `ResolvedStart.legacy` for requests without one. */
  private resolveStart(dto: { saveAsDraft?: boolean; start?: PlanStartInput; startDate?: string }): ResolvedStart {
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

  /** Metrics snapshot stored with the plan: user input merged over the current estimate. */
  private async buildMetricsSnapshot(
    athleteId: string,
    metrics?: AthleteMetrics | null,
  ): Promise<TrainingPlanMetricsSnapshot> {
    const snapshot = await this.planLifecycle.captureMetricsSnapshot(athleteId);
    if (!metrics) {
      return snapshot;
    }

    const violations = this.athleteMetrics.validateMetrics(metrics);
    if (violations.length > 0) {
      throw new DomainBadRequestException('PLAN_METRICS_INVALID', `Invalid metrics: ${violations.join(', ')}`);
    }

    const provided = Object.fromEntries(
      Object.entries(metrics).filter(([, value]) => value !== null && value !== undefined),
    );
    this.eventEmitter.emit(TRAINING_EVENTS.PLAN_METRICS_ENTERED, new PlanMetricsEnteredEvent(athleteId, metrics));
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
      throw new DomainBadRequestException(
        'MANUAL_PLAN_CONFIG_INVALID',
        `sessionsPerWeek (${input.structure.sessionsPerWeek}) cannot exceed the number of training days (${input.schedule.trainingDays.length})`,
      );
    }
  }

  /** Athlete view the engine generates from, with the user's manual schedule applied. */
  private applyManualScheduleToAthlete(athlete: Athlete, dto: ManualPlanConfigInput): AthleteView {
    const trainingDays =
      dto.schedule.trainingDays.length > 0
        ? dto.schedule.trainingDays
            .map((dayIndex) => TRAINING_WEEKDAY_ORDER[dayIndex])
            .filter((day): day is (typeof TRAINING_WEEKDAY_ORDER)[number] => Boolean(day))
        : [...TRAINING_DEFAULT_AVAILABILITY];

    return {
      ...toAthleteView(athlete),
      sessionsPerWeek: dto.structure.sessionsPerWeek,
      availableTrainingDays: trainingDays,
      preferredWorkoutDurationMinutes: dto.schedule.workoutDurationMinutes ?? athlete.preferredWorkoutDurationMinutes,
    };
  }
}
