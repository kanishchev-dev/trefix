import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';

import { DomainConflictException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { TrainingPlan, TrainingPlanMetricsSnapshot } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { GoalCreatedEvent } from '../events/goal-created.event';
import { PlanCancelledEvent } from '../events/plan-cancelled.event';
import { PlanCompletedEvent } from '../events/plan-completed.event';
import { PlanCreatedEvent } from '../events/plan-created.event';
import { PlanGeneratedEvent } from '../events/plan-generated.event';
import { PlanStartedEvent } from '../events/plan-started.event';
import { PlanCancelReason, PLANS_PER_ATHLETE_LIMIT } from '../training.constants';
import { TrainingEngine } from '../training.engine';
import { AthleteMetricsService } from './athlete-metrics.service';
import type { CreatePlanInput, PlanStartBehavior, PlanStartInput } from './plan-lifecycle.types';
import { PlanMaterializer } from './plan-materializer.service';
import { PlanStatsService } from './plan-stats.service';
import {
  addDaysIso,
  ensureGoalTargetDateAllowed,
  ensureStartDateAllowed,
  parseIsoDate,
  todayIsoInTz,
} from './plan-utils';

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
    private readonly materializer: PlanMaterializer,
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
          TRAINING_EVENTS.PLAN_CREATED,
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
        throw new DomainNotFoundException('TRAINING_PLAN_NOT_FOUND', 'Training plan not found');
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
        throw new DomainNotFoundException('TRAINING_PLAN_NOT_FOUND', 'Training plan not found');
      }
      await this.lockAthlete(plan.athleteId, transaction);
      if (plan.status !== 'active') {
        throw new DomainConflictException('PLAN_INVALID_STATUS', 'Only an active plan can be cancelled');
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

  /** Fresh metrics snapshot from the athlete state and recent workouts. */
  async captureMetricsSnapshot(athleteId: string): Promise<TrainingPlanMetricsSnapshot> {
    const current = await this.metricsService.currentMetrics(athleteId);
    return this.metricsService.toSnapshotMetrics(current) as TrainingPlanMetricsSnapshot;
  }

  /** Locks the athlete row; serializes every flow that can touch the active plan. */
  async lockAthlete(athleteId: string, transaction: Transaction): Promise<Athlete> {
    const athlete = await this.athleteModel.findByPk(athleteId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!athlete) {
      throw new DomainNotFoundException('TRAINING_PLAN_NOT_FOUND', 'Athlete not found');
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
      throw new DomainConflictException('PLAN_INVALID_STATUS', 'Only a draft plan can be started');
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
        throw new DomainConflictException('ACTIVE_PLAN_EXISTS', 'Another plan is already active', {
          activePlan: summary,
        });
      }
      replaced = await this.cancelInTransaction(active, 'replaced', input.timezone, transaction);
    }

    const { goal, created: goalCreated } = await this.materializer.resolveGoal(plan, input, behavior, transaction);
    const relativeWeeks = await this.materializer.resolveDraftWeeks(plan, transaction);
    const materialized = this.engine.materializeWeeks(relativeWeeks, new Date(`${startDate}T00:00:00Z`));
    await this.materializer.persistMaterialized(plan, goal.id, materialized, transaction);

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
        throw new DomainConflictException('ACTIVE_PLAN_EXISTS', 'Another plan is already active');
      }
      throw error;
    }

    if (replaced) {
      replaced.plan.replacedByPlanId = plan.id;
      await replaced.plan.save({ transaction });
    }

    transaction.afterCommit(() => {
      if (goalCreated) {
        this.eventEmitter.emit(TRAINING_EVENTS.GOAL_CREATED, new GoalCreatedEvent(plan.athleteId, goal.id));
      }
      this.eventEmitter.emit(
        TRAINING_EVENTS.PLAN_GENERATED,
        new PlanGeneratedEvent(plan.athleteId, plan.id, plan.creationSource),
      );
      this.eventEmitter.emit(
        TRAINING_EVENTS.PLAN_STARTED,
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
        TRAINING_EVENTS.PLAN_CANCELLED,
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
        this.eventEmitter.emit(TRAINING_EVENTS.PLAN_COMPLETED, new PlanCompletedEvent(plan.athleteId, plan.id));
      });
      return true;
    });
  }

  private async ensurePlansLimit(athleteId: string, transaction: Transaction): Promise<void> {
    const limit = this.configService.get<number>('training.plansPerAthleteLimit') ?? PLANS_PER_ATHLETE_LIMIT;
    const count = await this.planModel.count({ where: { athleteId }, transaction });
    if (count >= limit) {
      throw new DomainConflictException('PLANS_LIMIT_REACHED', `Plan limit of ${limit} reached`);
    }
  }

  /** Plans whose end date is before this day are complete (one day of timezone slack). */
  private completionCutoff(): string {
    return addDaysIso(todayIsoInTz('UTC'), -1);
  }
}
