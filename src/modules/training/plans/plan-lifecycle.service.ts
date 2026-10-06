import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';

import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { TrainingPlan, TrainingPlanConfig, TrainingPlanMetricsSnapshot } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { GoalCreatedEvent } from '../events/goal-created.event';
import { PlanCancelledEvent } from '../events/plan-cancelled.event';
import { PlanCompletedEvent } from '../events/plan-completed.event';
import { PlanCreatedEvent } from '../events/plan-created.event';
import { PlanGeneratedEvent } from '../events/plan-generated.event';
import { PlanStartedEvent } from '../events/plan-started.event';
import { deriveLegacyRaceFields, type GoalPayloadShape } from '../goal-taxonomy';
import {
  DRAFT_METRICS_STALE_DAYS,
  PlanCancelReason,
  PlanCreationSource,
  PLANS_PER_ATHLETE_LIMIT,
} from '../training.constants';
import { MaterializeResult, RelativeWeek, TrainingEngine } from '../training.engine';
import { AthleteMetricsService } from './athlete-metrics.service';
import { ActivePlanSummary, PlanStatsService } from './plan-stats.service';
import { asRelativeWeeks, hasRelativeWorkouts } from './plan-structure';
import {
  addDaysIso,
  ensureGoalTargetDateAllowed,
  ensureStartDateAllowed,
  mondayIndex,
  parseIsoDate,
  todayIsoInTz,
} from './plan-utils';

export interface PlanStartInput {
  startDate: string;
  goalTargetDate?: string | null;
  replaceActive: boolean;
  timezone?: string | null;
}

export interface PlanStartBehavior {
  /** Metrics to snapshot at start; defaults to the plan's own snapshot or a fresh estimate. */
  metrics?: TrainingPlanMetricsSnapshot | null;
  /** Reuse an existing goal (engine-generated plans) instead of creating one from the config. */
  existingGoalId?: string | null;
  /** Legacy clients may send yesterday's date across timezones; the date is clamped instead of rejected. */
  clampPastStartDate?: boolean;
}

export interface CreatePlanInput {
  athleteId: string;
  name: string;
  notes?: string | null;
  config: TrainingPlanConfig;
  creationSource: PlanCreationSource;
  trainingFrequency: number;
  weeklyTargetKm: number;
  weeks: RelativeWeek[];
  metricsSnapshot: TrainingPlanMetricsSnapshot | null;
  sourcePlanId?: string | null;
}

export type StartOptionKind = 'today' | 'next_monday' | 'race_aligned';

export interface StartOption {
  kind: StartOptionKind;
  startDate: string;
  endDate: string;
  goalTargetDate?: string;
  fits?: boolean;
  weeksAvailable?: number;
  reason?: 'target_date_passed';
}

export interface StartOptionsResult {
  today: string;
  totalWeeks: number;
  options: StartOption[];
  recommended: StartOptionKind;
  metricsStale: boolean;
  activePlan: ActivePlanSummary | null;
}

interface GoalSnapshot {
  type?: string;
  current?: Record<string, unknown> | null;
  target?: Record<string, unknown> | null;
  description?: string | null;
  targetDate?: string | null;
  priority?: number;
}

/**
 * The only service that moves a plan between `draft`, `active`, `completed`
 * and `cancelled`. Every transition that can affect the active plan locks
 * the athlete row first, so "at most one active plan per athlete" holds even
 * under concurrent requests; the partial unique index is the last line of
 * defence and is mapped to the same domain error.
 */
@Injectable()
export class PlanLifecycleService {
  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectModel(AthleteGoal)
    private readonly goalModel: typeof AthleteGoal,
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly engine: TrainingEngine,
    private readonly metricsService: AthleteMetricsService,
    private readonly statsService: PlanStatsService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a plan as a draft and, when `start` is given, starts it in the
   * same transaction: a rejected start (e.g. another active plan) leaves no
   * orphan draft behind.
   */
  async createPlan(
    input: CreatePlanInput,
    start: PlanStartInput | null,
    behavior: PlanStartBehavior = {},
  ): Promise<TrainingPlan> {
    return this.inTransaction(async (transaction) => {
      await this.lockAthlete(input.athleteId, transaction);
      await this.ensurePlansLimit(input.athleteId, transaction);

      const plan = await this.planModel.create(
        {
          athleteId: input.athleteId,
          goalId: null,
          name: input.name.trim().slice(0, 80),
          notes: input.notes ?? null,
          status: 'draft',
          config: input.config,
          metricsSnapshot: input.metricsSnapshot,
          sourcePlanId: input.sourcePlanId ?? null,
          startDate: null,
          endDate: null,
          trainingFrequency: input.trainingFrequency,
          weeklyTargetKm: input.weeklyTargetKm,
          creationSource: input.creationSource,
          weeks: input.weeks as unknown as Array<Record<string, unknown>>,
        },
        { transaction },
      );

      transaction.afterCommit(() => {
        this.eventEmitter.emit(
          'training.plan.created',
          new PlanCreatedEvent(plan.athleteId, plan.id, 'draft', plan.creationSource, plan.sourcePlanId),
        );
      });

      if (start) {
        await this.startInTransaction(plan, start, transaction, behavior);
      }
      return plan;
    });
  }

  /** Starts an existing draft. */
  async startPlan(planId: string, input: PlanStartInput, behavior: PlanStartBehavior = {}): Promise<TrainingPlan> {
    return this.inTransaction(async (transaction) => {
      const plan = await this.planModel.findByPk(planId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!plan) {
        throw new DomainException('TRAINING_PLAN_NOT_FOUND', 'Training plan not found', HttpStatus.NOT_FOUND);
      }
      await this.startInTransaction(plan, input, transaction, behavior);
      return plan;
    });
  }

  /**
   * Cancels the active plan: future planned workouts become `cancelled`,
   * completed and past ones stay as history, the goal is closed.
   */
  async cancelActivePlan(
    planId: string,
    reason: PlanCancelReason,
    timezone?: string | null,
  ): Promise<{ plan: TrainingPlan; cancelledWorkouts: number }> {
    return this.inTransaction(async (transaction) => {
      const plan = await this.planModel.findByPk(planId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!plan) {
        throw new DomainException('TRAINING_PLAN_NOT_FOUND', 'Training plan not found', HttpStatus.NOT_FOUND);
      }
      await this.lockAthlete(plan.athleteId, transaction);
      if (plan.status !== 'active') {
        throw new DomainException('PLAN_INVALID_STATUS', 'Only an active plan can be cancelled', HttpStatus.CONFLICT);
      }

      return this.cancelInTransaction(plan, reason, timezone, transaction);
    });
  }

  /**
   * Lazy completion used by read endpoints, so the status does not depend on
   * whether the nightly job already ran.
   */
  async completeIfEnded(plan: TrainingPlan): Promise<TrainingPlan> {
    if (plan.status !== 'active' || !plan.endDate || plan.endDate >= this.completionCutoff()) {
      return plan;
    }

    const completed = await this.completePlan(plan.id);
    if (completed) {
      plan.status = 'completed';
    }
    return plan;
  }

  /** Completes every active plan that ended; used by the nightly job. */
  async completeEndedPlans(): Promise<number> {
    const ended = await this.planModel.findAll({
      where: { status: 'active', endDate: { [Op.lt]: this.completionCutoff() } },
      attributes: ['id'],
    });

    let completed = 0;
    for (const plan of ended) {
      if (await this.completePlan(plan.id)) {
        completed += 1;
      }
    }
    return completed;
  }

  /** Start options of a draft. */
  async getStartOptions(
    planId: string,
    timezone?: string | null,
    goalTargetDateOverride?: string | null,
  ): Promise<StartOptionsResult> {
    const plan = await this.planModel.findByPk(planId);
    if (!plan || plan.status !== 'draft') {
      throw new DomainException('TRAINING_PLAN_NOT_FOUND', 'Training plan not found', HttpStatus.NOT_FOUND);
    }

    const goal = (plan.config?.goal ?? {}) as GoalSnapshot;
    return this.buildStartOptions({
      athleteId: plan.athleteId,
      totalWeeks: plan.weeks.length,
      targetDate: goalTargetDateOverride || goal.targetDate || null,
      timezone,
      metricsStale: this.isMetricsStale(plan),
    });
  }

  /**
   * Start options for any plan shape, including not yet saved previews.
   * "Race aligned" puts the race date into the last plan week: the plan
   * starts on the Monday of the race week minus `totalWeeks - 1` weeks.
   */
  async buildStartOptions(input: {
    athleteId: string;
    totalWeeks: number;
    targetDate?: string | null;
    timezone?: string | null;
    metricsStale?: boolean;
  }): Promise<StartOptionsResult> {
    const today = todayIsoInTz(input.timezone);
    const totalWeeks = Math.max(1, input.totalWeeks);
    const endOf = (startDate: string): string => addDaysIso(startDate, totalWeeks * 7 - 1);

    const nextMonday = this.nextMondayOrToday(today);
    const options: StartOption[] = [
      { kind: 'today', startDate: today, endDate: endOf(today) },
      { kind: 'next_monday', startDate: nextMonday, endDate: endOf(nextMonday) },
    ];
    let recommended: StartOptionKind = nextMonday === today ? 'today' : 'next_monday';

    const targetDate = input.targetDate ?? null;
    if (targetDate) {
      const alignedStart = addDaysIso(this.mondayOfWeek(targetDate), -(totalWeeks - 1) * 7);
      if (targetDate < today) {
        options.push({
          kind: 'race_aligned',
          startDate: alignedStart,
          endDate: endOf(alignedStart),
          goalTargetDate: targetDate,
          fits: false,
          reason: 'target_date_passed',
        });
      } else if (alignedStart >= today) {
        options.push({
          kind: 'race_aligned',
          startDate: alignedStart,
          endDate: endOf(alignedStart),
          goalTargetDate: targetDate,
          fits: true,
        });
        recommended = 'race_aligned';
      } else {
        options.push({
          kind: 'race_aligned',
          startDate: today,
          endDate: endOf(today),
          goalTargetDate: targetDate,
          fits: false,
          weeksAvailable: this.weeksBetween(today, targetDate),
        });
      }
    }

    const active = await this.planModel.findOne({ where: { athleteId: input.athleteId, status: 'active' } });
    return {
      today,
      totalWeeks,
      options,
      recommended,
      metricsStale: input.metricsStale ?? false,
      activePlan: active ? await this.statsService.buildActivePlanSummary(active, today) : null,
    };
  }

  /** Whether the draft metrics are older than the staleness window. */
  isMetricsStale(plan: TrainingPlan): boolean {
    const referenceIso = plan.metricsSnapshot?.capturedAt ?? plan.updatedAt.toISOString();
    const ageDays = (Date.now() - new Date(referenceIso).getTime()) / 86_400_000;
    return ageDays > DRAFT_METRICS_STALE_DAYS;
  }

  /** Fresh metrics snapshot from the athlete state and recent workouts. */
  async captureMetricsSnapshot(athleteId: string): Promise<TrainingPlanMetricsSnapshot> {
    const current = await this.metricsService.currentMetrics(athleteId);
    return this.metricsService.toSnapshotMetrics(current) as TrainingPlanMetricsSnapshot;
  }

  /** Locks the athlete row; serializes every flow that can touch the active plan. */
  async lockAthlete(athleteId: string, transaction: Transaction): Promise<Athlete> {
    const athlete = await this.athleteModel.findByPk(athleteId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!athlete) {
      throw new DomainException('TRAINING_PLAN_NOT_FOUND', 'Athlete not found', HttpStatus.NOT_FOUND);
    }
    return athlete;
  }

  /** Runs the work in the given transaction or opens a new one. */
  async inTransaction<T>(work: (transaction: Transaction) => Promise<T>, existing?: Transaction): Promise<T> {
    if (existing) {
      return work(existing);
    }
    return this.planModel.sequelize!.transaction(work);
  }

  // ------------------------------------------------------------------ internals

  private async startInTransaction(
    plan: TrainingPlan,
    input: PlanStartInput,
    transaction: Transaction,
    behavior: PlanStartBehavior,
  ): Promise<void> {
    const today = todayIsoInTz(input.timezone);
    const requested = parseIsoDate(input.startDate.slice(0, 10));
    const startDate = behavior.clampPastStartDate && requested < today ? today : requested;
    ensureStartDateAllowed(startDate, input.timezone);
    const goalTargetDate = input.goalTargetDate ? parseIsoDate(input.goalTargetDate.slice(0, 10)) : null;
    if (goalTargetDate) {
      ensureGoalTargetDateAllowed(startDate, goalTargetDate);
    }
    input = { ...input, goalTargetDate };

    if (plan.status !== 'draft') {
      throw new DomainException('PLAN_INVALID_STATUS', 'Only a draft plan can be started', HttpStatus.CONFLICT);
    }

    await this.lockAthlete(plan.athleteId, transaction);
    const active = await this.planModel.findOne({
      where: { athleteId: plan.athleteId, status: 'active', id: { [Op.ne]: plan.id } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let replaced: { plan: TrainingPlan; cancelledWorkouts: number } | null = null;
    if (active) {
      if (!input.replaceActive) {
        const summary = await this.statsService.buildActivePlanSummary(active, today);
        throw new DomainException('ACTIVE_PLAN_EXISTS', 'Another plan is already active', HttpStatus.CONFLICT, {
          activePlan: summary,
        });
      }
      replaced = await this.cancelInTransaction(active, 'replaced', input.timezone, transaction);
    }

    const { goal, created: goalCreated } = await this.resolveGoal(plan, input, behavior, transaction);
    const relativeWeeks = await this.resolveDraftWeeks(plan, transaction);
    const materialized = this.engine.materializeWeeks(relativeWeeks, new Date(`${startDate}T00:00:00Z`));
    await this.persistMaterialized(plan, goal.id, materialized, transaction);

    plan.goalId = goal.id;
    plan.status = 'active';
    plan.startDate = startDate;
    plan.endDate = materialized.endDate;
    plan.metricsSnapshot =
      behavior.metrics ?? plan.metricsSnapshot ?? (await this.captureMetricsSnapshot(plan.athleteId));
    plan.trainingFrequency = Math.max(
      1,
      ...relativeWeeks.map((week) => week.workouts.filter((workout) => workout.type !== 'rest').length),
    );
    plan.config = { ...plan.config, goal: { ...plan.config.goal, targetDate: goal.targetDate ?? null } };

    try {
      await plan.save({ transaction });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DomainException('ACTIVE_PLAN_EXISTS', 'Another plan is already active', HttpStatus.CONFLICT);
      }
      throw error;
    }

    if (replaced) {
      replaced.plan.replacedByPlanId = plan.id;
      await replaced.plan.save({ transaction });
    }

    transaction.afterCommit(() => {
      if (goalCreated) {
        this.eventEmitter.emit('training.goal.created', new GoalCreatedEvent(plan.athleteId, goal.id));
      }
      this.eventEmitter.emit(
        'training.plan.generated',
        new PlanGeneratedEvent(plan.athleteId, plan.id, plan.creationSource),
      );
      this.eventEmitter.emit(
        'training.plan.started',
        new PlanStartedEvent(plan.athleteId, plan.id, replaced?.plan.id ?? null),
      );
    });
  }

  private async cancelInTransaction(
    plan: TrainingPlan,
    reason: PlanCancelReason,
    timezone: string | null | undefined,
    transaction: Transaction,
  ): Promise<{ plan: TrainingPlan; cancelledWorkouts: number }> {
    // Workouts store the calendar date at UTC midnight, so "today and later"
    // is compared against the UTC midnight of the athlete's local date.
    const todayStart = new Date(`${todayIsoInTz(timezone)}T00:00:00Z`);
    const [cancelledWorkouts] = await this.workoutModel.update(
      { status: 'cancelled' },
      { where: { planId: plan.id, status: 'planned', scheduledAt: { [Op.gte]: todayStart } }, transaction },
    );

    plan.status = 'cancelled';
    plan.cancelledAt = new Date();
    plan.cancelReason = reason;
    await plan.save({ transaction });

    if (plan.goalId) {
      await this.goalModel.update(
        { status: 'cancelled' },
        { where: { id: plan.goalId, status: 'active' }, transaction },
      );
    }

    transaction.afterCommit(() => {
      this.eventEmitter.emit(
        'training.plan.cancelled',
        new PlanCancelledEvent(plan.athleteId, plan.id, reason, cancelledWorkouts),
      );
    });
    return { plan, cancelledWorkouts };
  }

  private async completePlan(planId: string): Promise<boolean> {
    return this.inTransaction(async (transaction) => {
      const plan = await this.planModel.findByPk(planId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!plan || plan.status !== 'active') {
        return false;
      }

      plan.status = 'completed';
      await plan.save({ transaction });
      if (plan.goalId) {
        await this.goalModel.update(
          { status: 'completed' },
          { where: { id: plan.goalId, status: 'active' }, transaction },
        );
      }
      transaction.afterCommit(() => {
        this.eventEmitter.emit('training.plan.completed', new PlanCompletedEvent(plan.athleteId, plan.id));
      });
      return true;
    });
  }

  private async resolveGoal(
    plan: TrainingPlan,
    input: PlanStartInput,
    behavior: PlanStartBehavior,
    transaction: Transaction,
  ): Promise<{ goal: AthleteGoal; created: boolean }> {
    const snapshot = (plan.config?.goal ?? {}) as GoalSnapshot;

    if (behavior.existingGoalId) {
      const existing = await this.goalModel.findByPk(behavior.existingGoalId, { transaction });
      if (existing && existing.athleteId === plan.athleteId) {
        existing.status = 'active';
        if (input.goalTargetDate) {
          existing.targetDate = input.goalTargetDate;
        }
        await existing.save({ transaction });
        return { goal: existing, created: false };
      }
    }

    const payload = {
      type: (snapshot.type ?? 'prepare_for_race') as GoalPayloadShape['type'],
      current: snapshot.current ?? undefined,
      target: snapshot.target ?? undefined,
      description: snapshot.description ?? undefined,
    };
    const legacyFields = deriveLegacyRaceFields(payload);
    const goal = await this.goalModel.create(
      {
        athleteId: plan.athleteId,
        type: payload.type,
        payload: { current: payload.current, target: payload.target ?? {}, description: payload.description },
        raceDistance: legacyFields.raceDistance,
        targetTimeSeconds: legacyFields.targetTimeSeconds,
        targetDate: input.goalTargetDate ?? snapshot.targetDate ?? null,
        priority: snapshot.priority ?? 5,
        status: 'active',
        notes: null,
      },
      { transaction },
    );
    return { goal, created: true };
  }

  /**
   * Drafts created before the lifecycle model kept dated weeks and workout
   * rows; they are converted into the relative structure on start and their
   * stale rows are removed, so the plan is materialized exactly once.
   */
  private async resolveDraftWeeks(plan: TrainingPlan, transaction: Transaction): Promise<RelativeWeek[]> {
    if (hasRelativeWorkouts(plan.weeks)) {
      return asRelativeWeeks(plan.weeks);
    }

    const workouts = await this.workoutModel.findAll({ where: { planId: plan.id }, transaction });
    const relative = this.engine.extractFinalVersion(
      { startDate: plan.startDate, endDate: plan.endDate },
      workouts.map((workout) => ({
        weekNumber: workout.weekNumber,
        orderInWeek: workout.orderInWeek,
        scheduledAt: workout.scheduledAt,
        type: workout.type,
        phase: workout.phase,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: (workout.target as Record<string, unknown>) ?? {},
        steps: (workout.steps as Array<Record<string, unknown>>) ?? [],
      })),
    );
    await this.workoutModel.destroy({ where: { planId: plan.id }, transaction });
    return relative;
  }

  private async persistMaterialized(
    plan: TrainingPlan,
    goalId: string,
    materialized: MaterializeResult,
    transaction: Transaction,
  ): Promise<void> {
    const created = await this.workoutModel.bulkCreate(
      materialized.workouts.map((workout) => ({
        athleteId: plan.athleteId,
        goalId,
        planId: plan.id,
        weekNumber: workout.weekNumber,
        scheduledAt: workout.scheduledAt,
        type: workout.type,
        phase: workout.phase,
        status: 'planned',
        orderInWeek: workout.orderInWeek,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: workout.target,
        steps: workout.steps,
        actual: null,
        analysis: null,
        completedAt: null,
      })),
      { transaction, returning: true },
    );

    const idByKey = new Map(materialized.workouts.map((workout, index) => [workout.key, created[index]?.id]));
    plan.weeks = materialized.weeks.map((week) => ({
      ...week,
      workoutIds: ((week.workoutIds as string[]) ?? [])
        .map((key) => idByKey.get(key))
        .filter((id): id is string => Boolean(id)),
    }));
  }

  private async ensurePlansLimit(athleteId: string, transaction: Transaction): Promise<void> {
    const limit = this.configService.get<number>('training.plansPerAthleteLimit') ?? PLANS_PER_ATHLETE_LIMIT;
    const count = await this.planModel.count({ where: { athleteId }, transaction });
    if (count >= limit) {
      throw new DomainException('PLANS_LIMIT_REACHED', `Plan limit of ${limit} reached`, HttpStatus.CONFLICT);
    }
  }

  /** Plans whose end date is before this day are complete (one day of timezone slack). */
  private completionCutoff(): string {
    return addDaysIso(todayIsoInTz('UTC'), -1);
  }

  private mondayOfWeek(dateIso: string): string {
    return addDaysIso(dateIso, -mondayIndex(new Date(`${dateIso}T00:00:00Z`)));
  }

  private nextMondayOrToday(todayIso: string): string {
    const weekday = mondayIndex(new Date(`${todayIso}T00:00:00Z`));
    return weekday === 0 ? todayIso : addDaysIso(todayIso, 7 - weekday);
  }

  private weeksBetween(fromIso: string, toIso: string): number {
    const days = Math.floor(
      (new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / 86_400_000,
    );
    return Math.max(0, Math.floor(days / 7) + 1);
  }
}
