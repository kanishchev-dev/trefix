import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { DomainConflictException } from '@/common/exceptions/domain-exceptions';
import { emitAfterCommit } from '@/common/utils/transaction-events.util';

import { AdaptationsService } from '../adaptations/adaptations.service';
import { AthleteStateService } from '../athletes/athlete-state.service';
import { Workout } from '../entities/workout.entity';
import { WorkoutCompletedEvent } from '../events/workout-completed.event';
import { ImportedWorkoutFacts } from '../interfaces/imported-workout.interface';
import { WorkoutView } from '../interfaces/training-views.interface';
import {
  IMPORTED_LONG_RUN_FACTOR,
  IMPORTED_LONG_RUN_MIN_KM,
  IMPORTED_LONG_RUN_WINDOW_DAYS,
  type WorkoutType,
} from '../training.constants';
import { TrainingEngine, type WorkoutAnalysisResult } from '../training.engine';
import { TRAINING_EVENTS } from '../training.events';
import { toWorkoutView } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Details recorded by the in-app tracker on top of the imported facts. */
export interface TrackerWorkoutDetails {
  /** Workout type the user picked; applied only to a workout the recording created. */
  type?: WorkoutType;
  /** Runs not measured outdoors by satellites never count towards distance records. */
  excludeFromRecords?: boolean;
  rpe?: number | null;
  notes?: string | null;
}

/** What happened to a workout whose last imported source disappeared. */
export type RevertedWorkoutOutcome = 'replanned' | 'deleted';

/**
 * Public port of the training module for activity imports (Strava, Apple
 * Health, Health Connect, the in-app tracker).
 *
 * The caller is the system, not a user: ownership was established by the
 * integration that delivered the facts. Each operation writes the workout, its
 * load and the recalculated state in one transaction.
 */
@Injectable()
export class WorkoutImportService {
  constructor(
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly lookup: TrainingLookupService,
    private readonly athleteState: AthleteStateService,
    private readonly adaptations: AdaptationsService,
    private readonly trainingEngine: TrainingEngine,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Completes a planned workout with imported facts; the plan adapts as after a manual completion. */
  async completeWorkoutFromImport(workoutId: string, facts: ImportedWorkoutFacts): Promise<WorkoutView> {
    return this.inTransaction(async (transaction) => {
      const workout = await this.lookup.workoutForUpdate(workoutId, transaction);
      const athlete = await this.lookup.athlete(workout.athleteId, transaction);
      if (workout.status !== 'planned') {
        throw new DomainConflictException(
          'WORKOUT_NOT_PLANNED',
          'Only a planned workout can be completed by an import',
        );
      }

      const analysisResult = this.analyze(workout, facts);
      workout.status = 'completed';
      workout.sourceProvider = facts.sourceProvider;
      workout.sourceActivityId = facts.sourceActivityId;
      workout.actual = this.toActual(facts, null);
      workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
      workout.completedAt = facts.endedAt;
      await workout.save({ transaction });

      const loadRecord = await this.athleteState.recordWorkoutLoad(athlete.id, workout, analysisResult, transaction);
      const state = await this.athleteState.recalculate(athlete.id, transaction);
      await this.adaptations.decideAndApply(
        athlete,
        workout,
        analysisResult.analysis,
        state,
        { origin: 'automatic' },
        transaction,
      );

      this.emitCompleted(athlete.id, workout.id, loadRecord.load, transaction);
      return toWorkoutView(workout);
    });
  }

  /** Creates a completed ad-hoc workout from imported facts. */
  async createImportedWorkout(athleteId: string, facts: ImportedWorkoutFacts): Promise<WorkoutView> {
    const athlete = await this.lookup.athlete(athleteId);
    const type = facts.sport === 'run' ? await this.resolveType(athlete.id, facts) : 'easy';

    return this.inTransaction(async (transaction) => {
      const workout = await this.workoutModel.create(
        {
          athleteId: athlete.id,
          goalId: null,
          planId: null,
          weekNumber: 1,
          scheduledAt: facts.startedAt,
          type,
          sport: facts.sport,
          phase: 'adhoc',
          status: 'completed',
          orderInWeek: 1,
          durationMinutes: facts.durationMinutes,
          distanceKm: facts.distanceKm,
          target: { source: facts.sourceProvider },
          steps: [],
          actual: null,
          analysis: null,
          completedAt: facts.endedAt,
          sourceProvider: facts.sourceProvider,
          sourceActivityId: facts.sourceActivityId,
          // Records, VDOT and running totals count only runs.
          excludeFromRecords: facts.sport !== 'run',
        },
        { transaction },
      );
      const analysisResult = this.analyze(workout, facts);
      workout.actual = this.toActual(facts, null);
      workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
      await workout.save({ transaction });

      const loadRecord = await this.athleteState.recordWorkoutLoad(athlete.id, workout, analysisResult, transaction);
      await this.athleteState.recalculate(athlete.id, transaction);

      this.emitCompleted(athlete.id, workout.id, loadRecord.load, transaction);
      return toWorkoutView(workout);
    });
  }

  /**
   * Replaces the facts of a completed workout: a provider updated the activity,
   * its sources were merged, or a manually closed workout got a device record.
   * RPE and notes entered by the user are kept.
   */
  async applyImportedFacts(workoutId: string, facts: ImportedWorkoutFacts): Promise<WorkoutView> {
    return this.inTransaction(async (transaction) => {
      const workout = await this.lookup.workoutForUpdate(workoutId, transaction);
      if (workout.status !== 'completed') {
        throw new DomainConflictException('WORKOUT_NOT_COMPLETED', 'Imported facts update only completed workouts');
      }

      const analysisResult = this.analyze(workout, facts);
      workout.sourceProvider = facts.sourceProvider;
      workout.sourceActivityId = facts.sourceActivityId;
      workout.actual = this.toActual(facts, workout.actual);
      workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
      workout.completedAt = facts.endedAt;
      // A plan workout keeps its planned slot and targets; an ad-hoc one mirrors the run.
      if (!workout.planId) {
        workout.scheduledAt = facts.startedAt;
        workout.durationMinutes = facts.durationMinutes;
        workout.distanceKm = facts.distanceKm;
        workout.sport = facts.sport;
        if (facts.sport !== 'run') {
          workout.excludeFromRecords = true;
        }
      }
      await workout.save({ transaction });

      await this.athleteState.recordWorkoutLoad(workout.athleteId, workout, analysisResult, transaction);
      await this.athleteState.recalculate(workout.athleteId, transaction);
      return toWorkoutView(workout);
    });
  }

  /** Undoes an import whose last source disappeared: a plan workout returns to `planned`, an ad-hoc one is deleted. */
  async revertImportedWorkout(workoutId: string): Promise<RevertedWorkoutOutcome> {
    return this.inTransaction(async (transaction) => {
      const workout = await this.lookup.workoutForUpdate(workoutId, transaction);
      const athleteId = workout.athleteId;
      await this.athleteState.removeWorkoutLoad(workout.id, transaction);

      let outcome: RevertedWorkoutOutcome;
      if (workout.planId) {
        workout.status = 'planned';
        workout.actual = null;
        workout.analysis = null;
        workout.completedAt = null;
        workout.gearId = null;
        workout.deviceId = null;
        workout.sourceProvider = null;
        workout.sourceActivityId = null;
        await workout.save({ transaction });
        outcome = 'replanned';
      } else {
        // Frees the (athlete, provider, activity) unique slot held by the soft-deleted row.
        workout.sourceActivityId = null;
        await workout.save({ transaction });
        await workout.destroy({ transaction });
        outcome = 'deleted';
      }

      await this.athleteState.recalculate(athleteId, transaction);
      return outcome;
    });
  }

  /** Applies what the tracker knows beyond the activity facts; RPE and notes already entered are kept when absent. */
  async applyTrackerDetails(workoutId: string, details: TrackerWorkoutDetails): Promise<void> {
    const workout = await this.workoutModel.findByPk(workoutId);
    if (!workout) {
      return;
    }
    if (details.type) {
      workout.type = details.type;
    }
    if (details.excludeFromRecords) {
      workout.excludeFromRecords = true;
    }
    if (details.rpe != null || details.notes) {
      workout.actual = {
        ...(workout.actual ?? {}),
        rpe: details.rpe ?? workout.actual?.rpe ?? null,
        notes: details.notes ?? workout.actual?.notes ?? null,
      };
    }
    await workout.save();
  }

  private analyze(workout: Workout, facts: ImportedWorkoutFacts): WorkoutAnalysisResult {
    return this.trainingEngine.analyzeWorkout({
      plannedWorkout: toWorkoutView(workout),
      actualDurationMinutes: facts.durationMinutes,
      actualDistanceKm: facts.distanceKm,
      actualAveragePaceSecondsPerKm: facts.averagePaceSecondsPerKm ?? undefined,
      actualAverageHeartRate: facts.averageHeartRate ?? undefined,
    });
  }

  private toActual(facts: ImportedWorkoutFacts, previous: Record<string, unknown> | null): Record<string, unknown> {
    return {
      actualDurationMinutes: facts.durationMinutes,
      actualDistanceKm: facts.distanceKm,
      actualAveragePaceSecondsPerKm: facts.averagePaceSecondsPerKm,
      actualAverageHeartRate: facts.averageHeartRate,
      maxHeartRate: facts.maxHeartRate,
      cadence: facts.cadence,
      calories: facts.calories,
      elevationGainMeters: facts.elevationGainMeters,
      indoor: facts.indoor,
      rpe: previous?.rpe ?? null,
      notes: previous?.notes ?? null,
    };
  }

  /** `long_run` when the run is clearly longer than usual, otherwise `easy`; analysis refines it later. */
  private async resolveType(athleteId: string, facts: ImportedWorkoutFacts): Promise<WorkoutType> {
    const windowStart = new Date(facts.startedAt.getTime() - IMPORTED_LONG_RUN_WINDOW_DAYS * DAY_MS);
    const recent = await this.workoutModel.findAll({
      where: {
        athleteId,
        status: 'completed',
        sport: 'run',
        scheduledAt: { [Op.gte]: windowStart, [Op.lt]: facts.startedAt },
      },
      attributes: ['distanceKm', 'actual'],
    });
    const distances = recent
      .map((entry) => Number(entry.actual?.actualDistanceKm ?? entry.distanceKm))
      .filter((value) => Number.isFinite(value) && value > 0);
    const average = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0;
    const threshold = Math.max(IMPORTED_LONG_RUN_MIN_KM, average * IMPORTED_LONG_RUN_FACTOR);
    return facts.distanceKm >= threshold ? 'long_run' : 'easy';
  }

  private emitCompleted(athleteId: string, workoutId: string, load: number, transaction: Transaction): void {
    emitAfterCommit(
      this.eventEmitter,
      transaction,
      TRAINING_EVENTS.WORKOUT_COMPLETED,
      new WorkoutCompletedEvent(athleteId, workoutId, load),
    );
  }

  private inTransaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.workoutModel.sequelize!.transaction(work);
  }
}
