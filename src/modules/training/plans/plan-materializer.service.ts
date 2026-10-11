import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { AthleteGoal } from '../entities/athlete-goal.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { deriveLegacyRaceFields, type GoalPayloadShape } from '../goal-taxonomy';
import { MaterializeResult, RelativeWeek, TrainingEngine } from '../training.engine';
import type { GoalSnapshot, PlanStartBehavior, PlanStartInput } from './plan-lifecycle.types';
import { asRelativeWeeks, hasRelativeWorkouts } from './plan-structure';

/**
 * Writes performed when a draft starts: the goal it trains for, the dated
 * workout rows and the week-to-workout links. Runs inside the caller's
 * transaction; status transitions stay in PlanLifecycleService.
 */
@Injectable()
export class PlanMaterializer {
  constructor(
    @InjectModel(AthleteGoal)
    private readonly goalModel: typeof AthleteGoal,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly engine: TrainingEngine,
  ) {}

  async resolveGoal(
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
  async resolveDraftWeeks(plan: TrainingPlan, transaction: Transaction): Promise<RelativeWeek[]> {
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

  async persistMaterialized(
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
}
