import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { DomainConflictException } from '@/common/exceptions/domain-exceptions';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { AthleteStateService } from '../athletes/athlete-state.service';
import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { TrainingPlanView } from '../interfaces/training-views.interface';
import { TrainingEngine, type TrainingStateComputation, type WorkoutBuildResult } from '../training.engine';
import { toAthleteView, toGoalView, toPlanView, toStateComputation } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';

/**
 * Engine regeneration of a plan that has not started yet.
 * Deprecated: started or manual plans are edited with the plan editing endpoints.
 */
@Injectable()
export class PlanRegenerationService {
  constructor(
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly lookup: TrainingLookupService,
    private readonly athleteState: AthleteStateService,
    private readonly trainingEngine: TrainingEngine,
  ) {}

  /**
   * Regenerates every workout of the active engine-created plan.
   * Deprecated: started or manual plans are edited with the plan editing endpoints.
   */
  async regeneratePlan(actorUserId: string, planId: string, startDate?: string): Promise<TrainingPlanView> {
    const plan = await this.lookup.plan(planId);
    const athlete = await this.lookup.ownedAthlete(plan.athleteId, actorUserId);

    if (plan.status !== 'active') {
      throw new DomainConflictException('PLAN_INVALID_STATUS', 'Only the active plan can be regenerated');
    }
    if (plan.creationSource === 'manual') {
      throw new DomainConflictException(
        'PLAN_REGENERATE_UNSUPPORTED',
        'Manual plans are edited with the plan editing endpoints instead',
      );
    }
    // Regeneration rewrites every workout; once training has history it would destroy it.
    const completedCount = await this.workoutModel.count({ where: { planId: plan.id, status: 'completed' } });
    if (completedCount > 0) {
      throw new DomainConflictException(
        'PLAN_REGENERATE_UNSUPPORTED',
        'The plan already has completed workouts; use the plan editing endpoints instead',
      );
    }
    if (!plan.goalId) {
      throw new EntityNotFoundException('Goal', plan.id);
    }

    const goal = await this.lookup.goal(plan.goalId);
    const state = toStateComputation(await this.athleteState.latest(athlete.id));
    const generatedPlan = this.trainingEngine.generatePlan(
      { ...toAthleteView(athlete), sessionsPerWeek: plan.trainingFrequency },
      toGoalView(goal),
      state,
      startDate ? new Date(startDate) : new Date(plan.startDate!),
    );

    const workouts = await this.workoutModel.sequelize!.transaction(async (transaction) => {
      await this.workoutModel.destroy({ where: { planId: plan.id }, transaction });
      const created = await this.workoutModel.bulkCreate(
        this.blueprintWorkouts(plan, athlete, goal, state, generatedPlan.workouts),
        { transaction, returning: true },
      );
      plan.startDate = generatedPlan.startDate;
      plan.endDate = generatedPlan.endDate;
      plan.trainingFrequency = generatedPlan.trainingFrequency;
      plan.weeklyTargetKm = generatedPlan.weeklyTargetKm;
      plan.weeks = generatedPlan.weeks.map((week) => ({
        ...week,
        workoutIds: created.filter((workout) => workout.weekNumber === Number(week.weekNumber)).map((w) => w.id),
      }));
      await plan.save({ transaction });
      return created;
    });

    return toPlanView(plan, workouts);
  }

  /** Planned workout rows for generated workouts, each rebuilt into a full blueprint (targets, steps). */
  private blueprintWorkouts(
    plan: TrainingPlan,
    athlete: Athlete,
    goal: AthleteGoal,
    state: TrainingStateComputation,
    workouts: WorkoutBuildResult[],
  ): Array<Partial<Workout>> {
    const athleteView = toAthleteView(athlete);
    const goalView = toGoalView(goal);

    return workouts.map((workout) => {
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
      return {
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
      };
    });
  }
}
