import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { DomainConflictException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { diffFields } from '@/common/utils/field-changes.util';
import { emitAfterCommit } from '@/common/utils/transaction-events.util';
import { UsersService } from '@/modules/users/users.service';

import { AdaptationsService } from './adaptations/adaptations.service';
import { AthleteStateService } from './athletes/athlete-state.service';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { Athlete } from './entities/athlete.entity';
import { Workout } from './entities/workout.entity';
import { WorkoutDeletedEvent } from './events/workout-deleted.event';
import { snapshotWorkoutFields, WorkoutUpdatedEvent } from './events/workout-updated.event';
import { GearAssignmentService } from './gear/gear-assignment.service';
import type { AdaptationEventView, WorkoutView } from './interfaces/training-views.interface';
import { ProgressService } from './progress/progress.service';
import type { RecordsExclusionView } from './progress/progress.views';
import { TrainingEngine } from './training.engine';
import { TRAINING_EVENTS } from './training.events';
import { toWorkoutView } from './training.mappers';
import { TrainingLookupService } from './training-lookup.service';
import { type WorkoutCompletionResult, WorkoutsService } from './workouts/workouts.service';

/** Sources whose facts the user typed in; anything else came from a recording or an integration. */
const HAND_ENTERED_SOURCES: ReadonlySet<string | null> = new Set([null, 'manual']);

/**
 * Admin-panel control over a single workout of any user: its actual result,
 * status, gear, records and adaptations. Every change runs through the same
 * engine, load and state recalculation as the athlete's own actions.
 */
@Injectable()
export class AdminWorkoutsService {
  constructor(
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly usersService: UsersService,
    private readonly lookup: TrainingLookupService,
    private readonly workoutsService: WorkoutsService,
    private readonly athleteState: AthleteStateService,
    private readonly trainingEngine: TrainingEngine,
    private readonly gearAssignmentService: GearAssignmentService,
    private readonly progressService: ProgressService,
    private readonly adaptationsService: AdaptationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getWorkout(userId: string, workoutId: string): Promise<WorkoutView> {
    const { workout } = await this.loadOwned(userId, workoutId);
    return toWorkoutView(workout);
  }

  /**
   * Logs the result the athlete did not record. A workout the system marked as
   * skipped can be completed too: the administrator knows it was done.
   */
  async complete(userId: string, workoutId: string, dto: CompleteWorkoutDto): Promise<WorkoutCompletionResult> {
    const { workout } = await this.loadOwned(userId, workoutId);
    if (workout.status === 'skipped') {
      workout.status = 'planned';
      await workout.save();
    }
    return this.workoutsService.completeWorkout(userId, workoutId, dto);
  }

  /** Corrects the actual result of a completed workout and recalculates its load and the athlete state. */
  async updateResult(userId: string, workoutId: string, dto: CompleteWorkoutDto): Promise<WorkoutView> {
    const { athlete } = await this.loadOwned(userId, workoutId);

    return this.workoutModel.sequelize!.transaction(async (transaction) => {
      const workout = await this.lookup.workoutForUpdate(workoutId, transaction);
      if (workout.status !== 'completed') {
        throw new DomainConflictException('WORKOUT_NOT_COMPLETED', 'Only a completed workout has a result to change');
      }
      const before = snapshotWorkoutFields(workout);
      const previousNotes = workout.actual?.['notes'];
      const analysisResult = this.trainingEngine.analyzeWorkout({
        plannedWorkout: toWorkoutView(workout),
        actualDurationMinutes: dto.actualDurationMinutes,
        actualDistanceKm: dto.actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
        actualAverageHeartRate: dto.actualAverageHeartRate,
        rpe: dto.rpe,
      });
      workout.actual = {
        ...(workout.actual ?? {}),
        actualDurationMinutes: dto.actualDurationMinutes,
        actualDistanceKm: dto.actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm ?? null,
        actualAverageHeartRate: dto.actualAverageHeartRate ?? null,
        rpe: dto.rpe ?? null,
        notes: dto.notes ?? (typeof previousNotes === 'string' ? previousNotes : null),
      };
      workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
      await workout.save({ transaction });

      await this.athleteState.recordWorkoutLoad(athlete.id, workout, analysisResult, transaction);
      await this.athleteState.recalculate(athlete.id, transaction);
      emitAfterCommit(
        this.eventEmitter,
        transaction,
        TRAINING_EVENTS.WORKOUT_UPDATED,
        new WorkoutUpdatedEvent(
          athlete.id,
          workout.id,
          workout.planId,
          userId,
          ['actual'],
          diffFields(before, snapshotWorkoutFields(workout), ['actual']),
        ),
      );
      return toWorkoutView(workout);
    });
  }

  /**
   * Returns a completed workout to `planned`, e.g. when it was closed by
   * mistake. Results that came from a recording or an integration are facts
   * and are not discarded this way.
   */
  async reopen(userId: string, workoutId: string): Promise<WorkoutView> {
    const { athlete } = await this.loadOwned(userId, workoutId);

    return this.workoutModel.sequelize!.transaction(async (transaction) => {
      const workout = await this.lookup.workoutForUpdate(workoutId, transaction);
      if (workout.status !== 'completed') {
        throw new DomainConflictException('WORKOUT_NOT_COMPLETED', 'Only a completed workout can be reopened');
      }
      if (!HAND_ENTERED_SOURCES.has(workout.sourceProvider)) {
        throw new DomainConflictException(
          'WORKOUT_HAS_SOURCES',
          'The result came from a recording or an integration and cannot be discarded',
        );
      }
      const before = snapshotWorkoutFields(workout);
      workout.status = 'planned';
      workout.actual = null;
      workout.analysis = null;
      workout.completedAt = null;
      await workout.save({ transaction });

      await this.athleteState.removeWorkoutLoad(workout.id, transaction);
      await this.athleteState.recalculate(athlete.id, transaction);
      emitAfterCommit(
        this.eventEmitter,
        transaction,
        TRAINING_EVENTS.WORKOUT_UPDATED,
        new WorkoutUpdatedEvent(
          athlete.id,
          workout.id,
          workout.planId,
          userId,
          ['status', 'actual'],
          diffFields(before, snapshotWorkoutFields(workout), ['status', 'actual']),
        ),
      );
      return toWorkoutView(workout);
    });
  }

  /** Removes a workout outside a plan in any status; plan workouts change through the plan. */
  async delete(userId: string, workoutId: string): Promise<void> {
    const { athlete, workout } = await this.loadOwned(userId, workoutId);
    if (workout.planId) {
      throw new DomainConflictException('WORKOUT_BELONGS_TO_PLAN', 'Plan workouts change through the plan');
    }

    await this.workoutModel.sequelize!.transaction(async (transaction) => {
      const wasCompleted = workout.status === 'completed';
      await workout.destroy({ transaction });
      if (wasCompleted) {
        await this.athleteState.removeWorkoutLoad(workout.id, transaction);
        await this.athleteState.recalculate(athlete.id, transaction);
      }
      emitAfterCommit(
        this.eventEmitter,
        transaction,
        TRAINING_EVENTS.WORKOUT_DELETED,
        new WorkoutDeletedEvent(athlete.id, workout.id, null, userId),
      );
    });
  }

  async setGear(
    userId: string,
    workoutId: string,
    gearId: string | null,
  ): Promise<{ workoutId: string; gearId: string | null }> {
    await this.loadOwned(userId, workoutId);
    return this.gearAssignmentService.assignToWorkout(userId, workoutId, gearId);
  }

  async setDevice(
    userId: string,
    workoutId: string,
    deviceId: string | null,
  ): Promise<{ workoutId: string; deviceId: string | null }> {
    await this.loadOwned(userId, workoutId);
    return this.gearAssignmentService.assignDeviceToWorkout(userId, workoutId, deviceId);
  }

  async setRecordsExcluded(userId: string, workoutId: string, excluded: boolean): Promise<RecordsExclusionView> {
    await this.loadOwned(userId, workoutId);
    return this.progressService.setRecordsExcluded(userId, workoutId, excluded);
  }

  async listAdaptations(userId: string): Promise<AdaptationEventView[]> {
    if (!(await this.findAthlete(userId))) {
      return [];
    }
    return this.adaptationsService.listPendingAdaptations(userId);
  }

  async applyAdaptation(userId: string, adaptationId: string): Promise<AdaptationEventView> {
    await this.requireAthlete(userId);
    return this.adaptationsService.applyProposedAdaptation(userId, adaptationId);
  }

  async dismissAdaptation(userId: string, adaptationId: string): Promise<AdaptationEventView> {
    await this.requireAthlete(userId);
    return this.adaptationsService.dismissProposedAdaptation(userId, adaptationId);
  }

  // ------------------------------------------------------------------ internals

  private async findAthlete(userId: string): Promise<Athlete | null> {
    await this.usersService.findOne(userId);
    return this.lookup.athleteByUserId(userId);
  }

  /** Athlete-keyed services create a missing profile; the admin flow refuses instead. */
  async requireAthlete(userId: string): Promise<Athlete> {
    const athlete = await this.findAthlete(userId);
    if (!athlete) {
      throw new DomainNotFoundException('ATHLETE_NOT_FOUND', `Athlete profile of user ${userId} not found`);
    }
    return athlete;
  }

  private async loadOwned(userId: string, workoutId: string): Promise<{ athlete: Athlete; workout: Workout }> {
    const athlete = await this.requireAthlete(userId);
    const workout = await this.workoutModel.findOne({ where: { id: workoutId, athleteId: athlete.id } });
    if (!workout) {
      throw new DomainNotFoundException('WORKOUT_NOT_FOUND', 'Workout not found');
    }
    return { athlete, workout };
  }
}
