import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { Athlete } from './entities/athlete.entity';
import { AthleteCreatedEvent } from './events/athlete-created.event';
import { AthleteUpdatedEvent } from './events/athlete-updated.event';
import { GoalCreatedEvent } from './events/goal-created.event';
import { PlanAdaptedEvent } from './events/plan-adapted.event';
import { PlanCancelledEvent } from './events/plan-cancelled.event';
import { PlanCompletedEvent } from './events/plan-completed.event';
import { PlanCreatedEvent } from './events/plan-created.event';
import { PlanDeletedEvent } from './events/plan-deleted.event';
import { PlanGeneratedEvent } from './events/plan-generated.event';
import { PlanStartedEvent } from './events/plan-started.event';
import { PlanUpdatedEvent } from './events/plan-updated.event';
import { AthleteStateUpdatedEvent } from './events/state-updated.event';
import { WorkoutCompletedEvent } from './events/workout-completed.event';

@Injectable()
export class TrainingListener {
  private readonly logger = new Logger(TrainingListener.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
  ) {}

  @OnEvent('training.athlete.created')
  handleAthleteCreated(event: AthleteCreatedEvent): void {
    this.logger.log(`training.athlete.created for athlete ${event.athleteId}`);
    this.realtimeService.emitToRoom('training', 'training.athlete.created', event);
  }

  @OnEvent('training.athlete.updated')
  handleAthleteUpdated(event: AthleteUpdatedEvent): void {
    this.logger.log(`training.athlete.updated for athlete ${event.athleteId}`);
    this.realtimeService.emitToRoom('training', 'training.athlete.updated', event);
  }

  @OnEvent('training.goal.created')
  handleGoalCreated(event: GoalCreatedEvent): void {
    this.logger.log(`training.goal.created for goal ${event.goalId}`);
    this.realtimeService.emitToRoom('training', 'training.goal.created', event);
  }

  @OnEvent('training.plan.generated')
  handlePlanGenerated(event: PlanGeneratedEvent): void {
    this.logger.log(`training.plan.generated for plan ${event.planId}`);
    this.realtimeService.emitToRoom('training', 'training.plan.generated', event);
  }

  @OnEvent('training.plan.created')
  async handlePlanCreated(event: PlanCreatedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'created', event.planId);
  }

  @OnEvent('training.plan.updated')
  async handlePlanUpdated(event: PlanUpdatedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, event.kind, event.planId);
  }

  @OnEvent('training.plan.deleted')
  async handlePlanDeleted(event: PlanDeletedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'deleted', event.planId);
  }

  @OnEvent('training.plan.started')
  async handlePlanStarted(event: PlanStartedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'started', event.planId);
  }

  @OnEvent('training.plan.cancelled')
  async handlePlanCancelled(event: PlanCancelledEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'cancelled', event.planId);
  }

  @OnEvent('training.plan.completed')
  async handlePlanCompleted(event: PlanCompletedEvent): Promise<void> {
    await this.emitPlansChanged(event.athleteId, 'completed', event.planId);
  }

  @OnEvent('training.state.updated')
  handleStateUpdated(event: AthleteStateUpdatedEvent): void {
    this.logger.log(`training.state.updated for state ${event.stateId}`);
    this.realtimeService.emitToRoom('training', 'training.state.updated', event);
  }

  @OnEvent('training.workout.completed')
  handleWorkoutCompleted(event: WorkoutCompletedEvent): void {
    this.logger.log(`training.workout.completed for workout ${event.workoutId}`);
    this.realtimeService.emitToRoom('training', 'training.workout.completed', event);
  }

  @OnEvent('training.plan.adapted')
  handlePlanAdapted(event: PlanAdaptedEvent): void {
    this.logger.log(`training.plan.adapted for plan ${event.planId}`);
    this.realtimeService.emitToRoom('training', 'training.plan.adapted', event);
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
}
