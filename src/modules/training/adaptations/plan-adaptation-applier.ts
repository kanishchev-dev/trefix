import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { Athlete } from '../entities/athlete.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { AthleteStateView } from '../interfaces/training-views.interface';
import { todayIsoInTz } from '../plans/plan-utils';
import { TrainingEngine } from '../training.engine';
import { toAthleteView, toGoalView, toPlanWeeks, toRecord, toStateComputation } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';

/**
 * Writes adaptation changes into the active plan.
 *
 * Only planned workouts from today on are touched — sessions before today are
 * history — and every change bumps the plan version.
 */
@Injectable()
export class PlanAdaptationApplier {
  constructor(
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly lookup: TrainingLookupService,
    private readonly trainingEngine: TrainingEngine,
  ) {}

  /** Planned workouts of the plan after the given one, from today on. */
  async upcomingAfter(plan: TrainingPlan, workout: Workout, transaction?: Transaction): Promise<Workout[]> {
    return this.workoutModel.findAll({
      where: {
        planId: plan.id,
        status: 'planned',
        scheduledAt: { [Op.gte]: this.startOfToday() },
        [Op.or]: [
          { weekNumber: { [Op.gt]: workout.weekNumber } },
          { weekNumber: workout.weekNumber, orderInWeek: { [Op.gt]: workout.orderInWeek } },
        ],
      },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
      ],
      transaction,
    });
  }

  /** Applies engine changes and rebuilds each changed workout's targets; returns how many workouts changed. */
  async applyWorkoutChanges(
    workouts: Workout[],
    athlete: Athlete,
    plan: TrainingPlan | null,
    state: AthleteStateView,
    changes: Array<Record<string, unknown>>,
    transaction?: Transaction,
  ): Promise<number> {
    if (!plan || changes.length === 0) {
      return 0;
    }

    const goal = plan.goalId ? await this.lookup.goal(plan.goalId) : null;
    const athleteView = toAthleteView(athlete);
    const goalView = goal ? toGoalView(goal) : null;
    const stateComputation = toStateComputation(state);
    const planWeeks = toPlanWeeks(plan.weeks);
    let changed = 0;

    for (const change of changes) {
      const targetWorkout = workouts.find((entry) => entry.id === change.workoutId);
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
        const rebuilt = this.trainingEngine.createWorkoutBlueprint({
          athlete: athleteView,
          goal: goalView,
          state: stateComputation,
          phase: targetWorkout.phase,
          weekNumber: targetWorkout.weekNumber,
          workoutType: targetWorkout.type,
          scheduledAt: targetWorkout.scheduledAt,
          orderInWeek: targetWorkout.orderInWeek,
          weekLoadTarget: weekPlan?.weeklyLoadTarget ?? Math.round(plan.weeklyTargetKm),
        });
        targetWorkout.durationMinutes = rebuilt.durationMinutes;
        targetWorkout.distanceKm = rebuilt.distanceKm;
        targetWorkout.target = rebuilt.target;
        targetWorkout.steps = rebuilt.steps;
      }

      await targetWorkout.save({ transaction });
      changed += 1;
    }
    return changed;
  }

  async applyHeartRateChanges(
    plan: TrainingPlan,
    changes: Array<Record<string, unknown>>,
    transaction: Transaction,
  ): Promise<void> {
    const byId = new Map(changes.map((change) => [String(change.workoutId), change]));
    const workouts = await this.workoutModel.findAll({
      where: {
        id: { [Op.in]: [...byId.keys()] },
        planId: plan.id,
        status: 'planned',
        scheduledAt: { [Op.gte]: this.startOfToday() },
      },
      transaction,
    });
    for (const workout of workouts) {
      const change = byId.get(workout.id);
      if (!change) continue;
      workout.target = {
        ...toRecord(workout.target),
        heartRateMinBpm: change.heartRateMinBpm,
        heartRateMaxBpm: change.heartRateMaxBpm,
      };
      await workout.save({ transaction });
    }
    if (workouts.length > 0) {
      await this.bumpPlanVersion(plan.id, transaction);
    }
  }

  /**
   * Adaptations change the plan too: bumping the version makes a pending user
   * edit based on the previous state fail instead of overwriting it.
   */
  async bumpPlanVersion(planId: string, transaction?: Transaction): Promise<void> {
    await this.planModel.increment('version', { where: { id: planId }, transaction });
  }

  /** Sessions before today are history and are never adapted. */
  startOfToday(): Date {
    return new Date(`${todayIsoInTz('UTC')}T00:00:00Z`);
  }
}
