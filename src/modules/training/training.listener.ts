import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { AthleteCreatedEvent } from './events/athlete-created.event';
import { AthleteUpdatedEvent } from './events/athlete-updated.event';
import { GoalCreatedEvent } from './events/goal-created.event';
import { PlanAdaptedEvent } from './events/plan-adapted.event';
import { PlanGeneratedEvent } from './events/plan-generated.event';
import { AthleteStateUpdatedEvent } from './events/state-updated.event';
import { WorkoutCompletedEvent } from './events/workout-completed.event';

@Injectable()
export class TrainingListener {
  private readonly logger = new Logger(TrainingListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

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
}
