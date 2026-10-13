import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { RealtimeService } from '@/modules/realtime/realtime.service';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import { Athlete } from './entities/athlete.entity';
import { AdminPlanActionEvent } from './events/admin-plan-action.event';
import { AthleteCreatedEvent } from './events/athlete-created.event';
import { AthleteUpdatedEvent } from './events/athlete-updated.event';
import { GoalCreatedEvent } from './events/goal-created.event';
import { PlanAdaptationProposedEvent, PlanAdaptedEvent } from './events/plan-adapted.event';
import { PlanCancelledEvent } from './events/plan-cancelled.event';
import { PlanCompletedEvent } from './events/plan-completed.event';
import { PlanCreatedEvent } from './events/plan-created.event';
import { PlanDeletedEvent } from './events/plan-deleted.event';
import { PlanGeneratedEvent } from './events/plan-generated.event';
import { PlanStartedEvent } from './events/plan-started.event';
import { PlanUpdatedEvent } from './events/plan-updated.event';
import { AthleteStateUpdatedEvent } from './events/state-updated.event';
import { WorkoutCompletedEvent } from './events/workout-completed.event';
import { WorkoutCreatedEvent } from './events/workout-created.event';
import { WorkoutDeletedEvent } from './events/workout-deleted.event';
import { WorkoutUpdatedEvent } from './events/workout-updated.event';

@Injectable()
export class TrainingListener {
  private readonly logger = new Logger(TrainingListener.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
  ) {}

  @OnEvent(TRAINING_EVENTS.ATHLETE_CREATED)
  handleAthleteCreated(event: AthleteCreatedEvent): void {
    this.logger.log(`training.athlete.created for athlete ${event.athleteId}`);
    this.realtimeService.emitToRoom('training', 'training.athlete.created', event);
  }

  @OnEvent(TRAINING_EVENTS.ATHLETE_UPDATED)
  handleAthleteUpdated(event: AthleteUpdatedEvent): void {
    this.logger.log(`training.athlete.updated for athlete ${event.athleteId}`);
    this.realtimeService.emitToRoom('training', 'training.athlete.updated', event);
    this.realtimeService.emitToUser(event.actorUserId, 'athlete.updated', { athleteId: event.athleteId });
  }

  @OnEvent(TRAINING_EVENTS.PLAN_ADAPTATION_PROPOSED)
  handleAdaptationProposed(event: PlanAdaptationProposedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'plan.adaptation.proposed', event);
  }

  @OnEvent(TRAINING_EVENTS.GOAL_CREATED)
  handleGoalCreated(event: GoalCreatedEvent): void {
    this.logger.log(`training.goal.created for goal ${event.goalId}`);
    this.realtimeService.emitToRoom('training', 'training.goal.created', event);
  }

  @OnEvent(TRAINING_EVENTS.PLAN_GENERATED)
  handlePlanGenerated(event: PlanGeneratedEvent): void {
    this.logger.log(`training.plan.generated for plan ${event.planId}`);
    this.realtimeService.emitToRoom('training', 'training.plan.generated', event);
  }

  @OnEvent(TRAINING_EVENTS.PLAN_CREATED)
  async handlePlanCreated(event: PlanCreatedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'created', event.planId);
  }

  @OnEvent(TRAINING_EVENTS.PLAN_UPDATED)
  async handlePlanUpdated(event: PlanUpdatedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, event.kind, event.planId);
  }

  @OnEvent(TRAINING_EVENTS.PLAN_DELETED)
  async handlePlanDeleted(event: PlanDeletedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'deleted', event.planId);
  }

  @OnEvent(TRAINING_EVENTS.PLAN_STARTED)
  async handlePlanStarted(event: PlanStartedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'started', event.planId);
  }

  @OnEvent(TRAINING_EVENTS.PLAN_CANCELLED)
  async handlePlanCancelled(event: PlanCancelledEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'cancelled', event.planId);
  }

  @OnEvent(TRAINING_EVENTS.PLAN_COMPLETED)
  async handlePlanCompleted(event: PlanCompletedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'completed', event.planId);
  }

  @OnEvent(TRAINING_EVENTS.STATE_UPDATED)
  handleStateUpdated(event: AthleteStateUpdatedEvent): void {
    this.logger.log(`training.state.updated for state ${event.stateId}`);
    this.realtimeService.emitToRoom('training', 'training.state.updated', event);
  }

  @OnEvent(TRAINING_EVENTS.WORKOUT_COMPLETED)
  handleWorkoutCompleted(event: WorkoutCompletedEvent): void {
    this.logger.log(`training.workout.completed for workout ${event.workoutId}`);
    this.realtimeService.emitToRoom('training', 'training.workout.completed', event);
  }

  @OnEvent(TRAINING_EVENTS.WORKOUT_CREATED)
  async handleWorkoutCreated(event: WorkoutCreatedEvent): Promise<void> {
    await this.emitWorkoutsChanged(event.athleteId, 'created', event.workoutId, event.planId);
  }

  @OnEvent(TRAINING_EVENTS.WORKOUT_UPDATED)
  async handleWorkoutUpdated(event: WorkoutUpdatedEvent): Promise<void> {
    await this.emitWorkoutsChanged(event.athleteId, 'updated', event.workoutId, event.planId);
  }

  @OnEvent(TRAINING_EVENTS.WORKOUT_DELETED)
  async handleWorkoutDeleted(event: WorkoutDeletedEvent): Promise<void> {
    await this.emitWorkoutsChanged(event.athleteId, 'deleted', event.workoutId, event.planId);
  }

  /**
   * Audit trail of admin-panel plan changes. The plan's own domain events
   * already refresh the athlete's clients; this one only records the actor.
   */
  @OnEvent(TRAINING_EVENTS.PLAN_ADMIN_ACTION)
  handleAdminPlanAction(event: AdminPlanActionEvent): void {
    this.logger.log(
      `training.plan.admin_action: ${event.action} plan ${event.planId} of user ${event.userId} by ${event.actorUserId}`,
    );
  }

  @OnEvent(TRAINING_EVENTS.PLAN_ADAPTED)
  async handlePlanAdapted(event: PlanAdaptedEvent): Promise<void> {
    this.logger.log(`training.plan.adapted for plan ${event.planId}`);
    this.realtimeService.emitToRoom('training', 'training.plan.adapted', event);
    await this.emitPlansChanged(event.athleteId, 'workouts', event.planId);
  }

  /**
   * Fans a plan lifecycle change out to the owning user's room as
   * `training.plans.changed`. The event payload
   * carries the athlete id, so the user room is resolved here.
   */
  private async emitPlansChanged(athleteId: string, reason: string, planId: string): Promise<void> {
    try {
      const athlete = await this.athleteModel.findByPk(athleteId);
      if (!athlete) {
        this.logger.warn(`Skipping realtime plan event for missing athlete ${athleteId}`);
        return;
      }

      this.realtimeService.emitToUser(athlete.userId, 'training.plans.changed', { reason, planId });
    } catch (error) {
      // Realtime fan-out is best-effort and must never fail the domain flow.
      this.logger.warn(`Failed to emit training.plans.changed for plan ${planId}: ${(error as Error).message}`);
    }
  }

  /**
   * Tells the owning user's clients that their calendar changed elsewhere (the
   * admin panel). A plan workout also refreshes plan caches, since plan
   * progress and the week view are derived from its workouts.
   */
  private async emitWorkoutsChanged(
    athleteId: string,
    reason: 'created' | 'updated' | 'deleted',
    workoutId: string,
    planId: string | null,
  ): Promise<void> {
    try {
      const athlete = await this.athleteModel.findByPk(athleteId);
      if (!athlete) {
        this.logger.warn(`Skipping realtime workout event for missing athlete ${athleteId}`);
        return;
      }

      this.realtimeService.emitToUser(athlete.userId, 'training.workouts.changed', { reason, workoutId, planId });
      if (planId) {
        this.realtimeService.emitToUser(athlete.userId, 'training.plans.changed', { reason: 'workouts', planId });
      }
    } catch (error) {
      // Realtime fan-out is best-effort and must never fail the domain flow.
      this.logger.warn(
        `Failed to emit training.workouts.changed for workout ${workoutId}: ${(error as Error).message}`,
      );
    }
  }
}
