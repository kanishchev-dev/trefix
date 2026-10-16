import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DomainBadRequestException, DomainConflictException } from '@/common/exceptions/domain-exceptions';
import { diffFields } from '@/common/utils/field-changes.util';

import { UpdateWorkoutDto } from '../dto/update-workout.dto';
import { Workout } from '../entities/workout.entity';
import { WorkoutDeletedEvent } from '../events/workout-deleted.event';
import { snapshotWorkoutFields, WorkoutUpdatedEvent, type WorkoutUpdatedField } from '../events/workout-updated.event';
import { WorkoutView } from '../interfaces/training-views.interface';
import { TRAINING_EVENTS } from '../training.events';
import { toWorkoutView } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';

export const MANUAL_WORKOUT_ERROR_CODES = {
  /** Plan workouts change through the plan, so the plan stays consistent. */
  inPlan: 'WORKOUT_IN_PLAN',
  /** Done or skipped workouts are training history. */
  notPlanned: 'WORKOUT_NOT_PLANNED',
  invalidDate: 'INVALID_DATE',
} as const;

/**
 * Edits and removal of workouts the user added by hand (no plan). Same rule as
 * creation: a planned manual workout lives on a future day.
 */
@Injectable()
export class ManualWorkoutsService {
  constructor(
    private readonly lookup: TrainingLookupService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Writes only the fields that actually change; the event lists them. */
  async updateWorkout(actorUserId: string, workoutId: string, dto: UpdateWorkoutDto): Promise<WorkoutView> {
    const workout = await this.loadEditable(actorUserId, workoutId);
    const before = snapshotWorkoutFields(workout);
    const changedFields: WorkoutUpdatedField[] = [];

    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (scheduledAt <= this.endOfToday()) {
        throw new DomainBadRequestException(
          MANUAL_WORKOUT_ERROR_CODES.invalidDate,
          'A planned workout can only be moved to a future date',
        );
      }
      if (scheduledAt.getTime() !== workout.scheduledAt.getTime()) {
        workout.scheduledAt = scheduledAt;
        changedFields.push('scheduledAt');
      }
    }
    if (dto.type !== undefined && dto.type !== workout.type) {
      workout.type = dto.type;
      changedFields.push('type');
    }
    if (dto.durationMinutes !== undefined && dto.durationMinutes !== workout.durationMinutes) {
      workout.durationMinutes = dto.durationMinutes;
      changedFields.push('durationMinutes');
    }
    if (dto.distanceKm !== undefined && dto.distanceKm !== workout.distanceKm) {
      workout.distanceKm = dto.distanceKm;
      changedFields.push('distanceKm');
    }

    if (changedFields.length === 0) {
      return toWorkoutView(workout);
    }

    await workout.save();
    this.eventEmitter.emit(
      TRAINING_EVENTS.WORKOUT_UPDATED,
      new WorkoutUpdatedEvent(
        workout.athleteId,
        workout.id,
        null,
        actorUserId,
        changedFields,
        diffFields(before, snapshotWorkoutFields(workout), changedFields),
      ),
    );
    return toWorkoutView(workout);
  }

  /** Soft-deletes the workout (the model is paranoid); its coach note and recordings go by cascade rules. */
  async deleteWorkout(actorUserId: string, workoutId: string): Promise<void> {
    const workout = await this.loadEditable(actorUserId, workoutId);
    await workout.destroy();
    this.eventEmitter.emit(
      TRAINING_EVENTS.WORKOUT_DELETED,
      new WorkoutDeletedEvent(workout.athleteId, workout.id, null, actorUserId),
    );
  }

  private async loadEditable(actorUserId: string, workoutId: string): Promise<Workout> {
    const workout = await this.lookup.workout(workoutId);
    await this.lookup.ownedAthlete(workout.athleteId, actorUserId);
    if (workout.planId) {
      throw new DomainConflictException(
        MANUAL_WORKOUT_ERROR_CODES.inPlan,
        'A plan workout is changed through its plan',
      );
    }
    if (workout.status !== 'planned' || workout.actual !== null) {
      throw new DomainConflictException(
        MANUAL_WORKOUT_ERROR_CODES.notPlanned,
        'Only a planned workout can be changed or removed',
      );
    }
    return workout;
  }

  private endOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }
}
