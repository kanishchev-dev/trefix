import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import {
  DomainBadRequestException,
  DomainConflictException,
  DomainNotFoundException,
} from '@/common/exceptions/domain-exceptions';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import { AdaptationEvent } from '../entities/adaptation-event.entity';
import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { PlanDeletedEvent } from '../events/plan-deleted.event';
import { PlanUpdatedEvent } from '../events/plan-updated.event';
import { ADAPTATION_TYPE_USER_EDIT, TRAINING_WEEKDAY_ORDER } from '../training.constants';
import { PlanDiff, RelativeWeek, TrainingEngine } from '../training.engine';
import { PlanChangeCalculator, PlanChangesInput, PlanMutation } from './plan-change-calculator';
import { PlanLifecycleService } from './plan-lifecycle.service';
import { applyRelativeOverrides, asRelativeWeeks, RelativeWeekOverride } from './plan-structure';

export interface PlanPreviewResult {
  diff: PlanDiff;
  warnings: string[];
  resultingEndDate: string | null;
  version: number;
}

/**
 * All mutations of an existing plan: name and notes in any status, the
 * structure of drafts, and the preview → apply protocol for the active plan.
 * Every write checks the client-known version, so edits made meanwhile by an
 * adaptation, the coach or another device are never silently overwritten.
 */
@Injectable()
export class PlanEditingService {
  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectModel(AthleteGoal)
    private readonly goalModel: typeof AthleteGoal,
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    @InjectModel(AdaptationEvent)
    private readonly adaptationEventModel: typeof AdaptationEvent,
    private readonly engine: TrainingEngine,
    private readonly calculator: PlanChangeCalculator,
    private readonly lifecycleService: PlanLifecycleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Loads a plan owned by the user; foreign and missing plans look the same. */
  async loadOwnedPlan(planId: string, actorUserId: string, transaction?: Transaction): Promise<TrainingPlan> {
    const plan = await this.planModel.findByPk(planId, {
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    if (!plan) {
      throw this.notFound();
    }

    const athlete = await this.athleteModel.findByPk(plan.athleteId, { transaction });
    if (!athlete || athlete.userId !== actorUserId) {
      throw this.notFound();
    }
    return plan;
  }

  /** Athlete profile of a user, if it exists. */
  async loadAthleteByUserId(actorUserId: string): Promise<Athlete | null> {
    return this.athleteModel.findOne({ where: { userId: actorUserId } });
  }

  /** Renames a plan and edits its notes; allowed in any status. */
  async updateMeta(
    planId: string,
    actorUserId: string,
    input: { name?: string; notes?: string | null; expectedVersion: number },
  ): Promise<TrainingPlan> {
    const plan = await this.loadOwnedPlan(planId, actorUserId);
    this.ensureVersion(plan, input.expectedVersion);

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length === 0) {
        throw new DomainBadRequestException('PLAN_CHANGE_INVALID', 'Plan name cannot be empty');
      }
      plan.name = name.slice(0, 80);
    }
    if (input.notes !== undefined) {
      plan.notes = input.notes === null || input.notes.trim() === '' ? null : input.notes.slice(0, 2000);
    }

    await plan.save();
    this.eventEmitter.emit(TRAINING_EVENTS.PLAN_UPDATED, new PlanUpdatedEvent(plan.athleteId, plan.id, 'meta'));
    return plan;
  }

  /** Soft-deletes a draft or history plan; workouts stay for progress and history. */
  async deletePlan(planId: string, actorUserId: string): Promise<void> {
    const plan = await this.loadOwnedPlan(planId, actorUserId);
    if (plan.status === 'active') {
      throw new DomainConflictException(
        'PLAN_ACTIVE_CANNOT_DELETE',
        'The active plan cannot be deleted; cancel it first',
      );
    }

    await plan.destroy();
    this.eventEmitter.emit(TRAINING_EVENTS.PLAN_DELETED, new PlanDeletedEvent(plan.athleteId, plan.id));
  }

  /** Edits the workouts of a draft by key; every change is validated by the engine. */
  async updateDraftStructure(
    planId: string,
    actorUserId: string,
    input: { expectedVersion: number; weekOverrides: RelativeWeekOverride[] },
  ): Promise<TrainingPlan> {
    const plan = await this.loadOwnedPlan(planId, actorUserId);
    if (plan.status !== 'draft') {
      throw new DomainConflictException('PLAN_INVALID_STATUS', 'Only a draft plan supports structure editing');
    }
    this.ensureVersion(plan, input.expectedVersion);

    const weeks = applyRelativeOverrides(this.engine, asRelativeWeeks(plan.weeks), input.weekOverrides, {
      errorCode: 'PLAN_CHANGE_INVALID',
      thresholdPaceSecondsPerKm: plan.metricsSnapshot?.thresholdPaceSecondsPerKm ?? null,
    });
    plan.weeks = weeks as unknown as Array<Record<string, unknown>>;
    await plan.save();
    this.eventEmitter.emit(TRAINING_EVENTS.PLAN_UPDATED, new PlanUpdatedEvent(plan.athleteId, plan.id, 'structure'));
    return plan;
  }

  /** Diff of a planned change of the active plan; persists nothing. */
  async previewChanges(planId: string, actorUserId: string, input: PlanChangesInput): Promise<PlanPreviewResult> {
    const plan = await this.loadOwnedPlan(planId, actorUserId);
    this.ensureActive(plan);
    this.ensureVersion(plan, input.expectedVersion);

    const workouts = await this.workoutModel.findAll({ where: { planId: plan.id } });
    const change = this.calculator.compute(plan, workouts, input);
    return {
      diff: change.diff,
      warnings: change.warnings,
      resultingEndDate: change.resultingEndDate,
      version: plan.version,
    };
  }

  /**
   * Applies a change of the active plan in one transaction: the same
   * computation as the preview, the persisted result, a `user_edit`
   * adaptation event and a version bump.
   */
  async applyChanges(planId: string, actorUserId: string, input: PlanChangesInput): Promise<TrainingPlan> {
    const plan = await this.lifecycleService.inTransaction(async (transaction) => {
      const locked = await this.loadOwnedPlan(planId, actorUserId, transaction);
      await this.lifecycleService.lockAthlete(locked.athleteId, transaction);
      this.ensureActive(locked);
      this.ensureVersion(locked, input.expectedVersion);

      const workouts = await this.workoutModel.findAll({ where: { planId: locked.id }, transaction });
      const change = this.calculator.compute(locked, workouts, input);
      await this.persistMutation(locked, workouts, change.mutation, transaction);

      await this.adaptationEventModel.create(
        {
          athleteId: locked.athleteId,
          planId: locked.id,
          workoutId: null,
          type: ADAPTATION_TYPE_USER_EDIT,
          input: { kind: input.kind, request: { ...input } },
          decision: { applied: true, kind: input.kind, diff: change.diff },
          reason: `user_edit_${input.kind}`,
          confidence: 1,
        },
        { transaction },
      );

      await locked.save({ transaction });
      transaction.afterCommit(() => {
        this.eventEmitter.emit(
          TRAINING_EVENTS.PLAN_UPDATED,
          new PlanUpdatedEvent(locked.athleteId, locked.id, input.kind),
        );
      });
      return locked;
    });

    return plan;
  }

  /**
   * Recomputes `plan.weeks[].workoutIds` from the rows, optionally with new
   * week metadata. Shared by every flow that adds, removes or moves workouts.
   */
  async syncWeeks(plan: TrainingPlan, transaction: Transaction, weeksMeta?: RelativeWeek[]): Promise<void> {
    const rows = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['scheduledAt', 'ASC'],
        ['orderInWeek', 'ASC'],
      ],
      transaction,
    });
    const stored = new Map(
      (plan.weeks ?? []).map((week) => [Number(week.weekNumber), week as Record<string, unknown>]),
    );
    const meta = weeksMeta?.map((week) => ({
      weekNumber: week.weekNumber,
      phase: week.phase,
      weeklyLoadTarget: week.weeklyLoadTarget ?? 0,
    })) ?? [...stored.values()];

    plan.weeks = meta.map((week) => {
      const weekNumber = Number(week.weekNumber);
      return {
        ...(stored.get(weekNumber) ?? {}),
        ...week,
        workoutIds: rows
          .filter((row) => row.weekNumber === weekNumber && row.status !== 'cancelled')
          .map((row) => row.id),
      };
    });
  }

  // ------------------------------------------------------------------ internals

  private async persistMutation(
    plan: TrainingPlan,
    workouts: Workout[],
    mutation: PlanMutation,
    transaction: Transaction,
  ): Promise<void> {
    const rows = new Map(workouts.map((row) => [row.id, row]));

    for (const id of mutation.removals) {
      await rows.get(id)?.destroy({ transaction });
    }
    for (const { id, patch } of mutation.updates) {
      const row = rows.get(id);
      if (row && !mutation.removals.includes(id)) {
        Object.assign(row, patch);
        await row.save({ transaction });
      }
    }
    if (mutation.creations.length > 0) {
      await this.workoutModel.bulkCreate(
        mutation.creations.map((creation) => ({
          ...creation,
          athleteId: plan.athleteId,
          goalId: plan.goalId,
          planId: plan.id,
          status: 'planned',
          actual: null,
          analysis: null,
          completedAt: null,
        })),
        { transaction },
      );
    }

    if (mutation.endDate) {
      plan.endDate = mutation.endDate;
    }
    if (mutation.config) {
      plan.config = mutation.config;
    }
    if (mutation.goalTargetDate && plan.goalId) {
      await this.goalModel.update({ targetDate: mutation.goalTargetDate }, { where: { id: plan.goalId }, transaction });
    }
    if (mutation.athleteSchedule) {
      const athlete = await this.athleteModel.findByPk(plan.athleteId, { transaction });
      if (athlete) {
        athlete.availableTrainingDays = mutation.athleteSchedule.trainingDays.map((day) => TRAINING_WEEKDAY_ORDER[day]);
        if (mutation.athleteSchedule.workoutDurationMinutes) {
          athlete.preferredWorkoutDurationMinutes = mutation.athleteSchedule.workoutDurationMinutes;
        }
        await athlete.save({ transaction });
      }
    }

    await this.syncWeeks(plan, transaction, mutation.weeks);
  }

  private ensureActive(plan: TrainingPlan): void {
    if (plan.status !== 'active') {
      throw new DomainConflictException('PLAN_INVALID_STATUS', 'Only the active plan supports this change');
    }
  }

  private ensureVersion(plan: TrainingPlan, expectedVersion: number): void {
    if (plan.version !== expectedVersion) {
      throw new DomainConflictException(
        'PLAN_VERSION_CONFLICT',
        `Plan was modified concurrently (expected version ${expectedVersion}, current ${plan.version})`,
      );
    }
  }

  private notFound(): DomainNotFoundException {
    return new DomainNotFoundException('TRAINING_PLAN_NOT_FOUND', 'Training plan not found');
  }
}
