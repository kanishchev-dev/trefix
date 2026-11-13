import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';

import { emitAfterCommit } from '@/common/utils/transaction-events.util';

import { AthleteState } from '../entities/athlete-state.entity';
import { TrainingLoad } from '../entities/training-load.entity';
import { Workout } from '../entities/workout.entity';
import { AthleteStateUpdatedEvent } from '../events/state-updated.event';
import { AthleteStateView } from '../interfaces/training-views.interface';
import { TRAINING_LOAD_ALGORITHM_VERSION } from '../training.constants';
import { TrainingEngine } from '../training.engine';
import { TRAINING_EVENTS } from '../training.events';
import { toAthleteView, toGoalView, toStateView } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';

/** Loads used for the fitness/fatigue model: enough history for the chronic window. */
const STATE_LOAD_HISTORY_LIMIT = 100;

export interface WorkoutLoadInput {
  trainingLoad: number;
  intensityFactor: number;
}

/**
 * Training load records and the athlete state derived from them.
 *
 * The state is append-only: every recalculation stores a new snapshot, the
 * latest one is current. Recalculate after any change to completed workouts.
 */
@Injectable()
export class AthleteStateService {
  constructor(
    @InjectModel(AthleteState)
    private readonly athleteStateModel: typeof AthleteState,
    @InjectModel(TrainingLoad)
    private readonly trainingLoadModel: typeof TrainingLoad,
    private readonly lookup: TrainingLookupService,
    private readonly trainingEngine: TrainingEngine,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Latest snapshot; computed on the spot for an athlete who has none yet. */
  async latest(athleteId: string): Promise<AthleteStateView> {
    const state = await this.athleteStateModel.findOne({ where: { athleteId }, order: [['createdAt', 'DESC']] });
    return state ? toStateView(state) : this.recalculate(athleteId);
  }

  /** Stores a fresh snapshot from the athlete's recent loads and latest goal. */
  async recalculate(athleteId: string, transaction?: Transaction): Promise<AthleteStateView> {
    const athlete = await this.lookup.athlete(athleteId, transaction);
    const goal = await this.lookup.latestGoal(athleteId, transaction);
    const recentLoads = await this.trainingLoadModel.findAll({
      where: { athleteId },
      order: [['occurredAt', 'DESC']],
      limit: STATE_LOAD_HISTORY_LIMIT,
      transaction,
    });
    const computation = this.trainingEngine.calculateTrainingState(
      toAthleteView(athlete),
      recentLoads.map((load) => ({ load: load.load, occurredAt: load.occurredAt })),
      goal ? toGoalView(goal) : null,
    );

    const state = await this.athleteStateModel.create(
      {
        athleteId: athlete.id,
        fitness: computation.fitness,
        fatigue: computation.fatigue,
        form: computation.form,
        thresholdPaceSecondsPerKm: computation.thresholdPaceSecondsPerKm,
        thresholdHeartRate: computation.thresholdHeartRate,
        vo2max: computation.vo2max,
        weeklyLoad: computation.weeklyLoad,
        acuteLoad: computation.acuteLoad,
        chronicLoad: computation.chronicLoad,
        recoveryScore: computation.recoveryScore,
        confidence: computation.confidence,
        source: computation.source,
      },
      { transaction },
    );

    emitAfterCommit(
      this.eventEmitter,
      transaction,
      TRAINING_EVENTS.STATE_UPDATED,
      new AthleteStateUpdatedEvent(athlete.id, state.id, state.confidence),
    );
    return toStateView(state);
  }

  /**
   * One load record per workout: re-completing or re-importing a workout
   * updates its load instead of counting the run twice.
   */
  async recordWorkoutLoad(
    athleteId: string,
    workout: Workout,
    analysis: WorkoutLoadInput,
    transaction?: Transaction,
  ): Promise<TrainingLoad> {
    const occurredAt = workout.completedAt ?? workout.scheduledAt;
    const existing = await this.trainingLoadModel.findOne({ where: { workoutId: workout.id }, transaction });
    if (existing) {
      existing.load = analysis.trainingLoad;
      existing.intensityFactor = analysis.intensityFactor;
      existing.occurredAt = occurredAt;
      existing.algorithmVersion = TRAINING_LOAD_ALGORITHM_VERSION;
      return existing.save({ transaction });
    }
    return this.trainingLoadModel.create(
      {
        athleteId,
        workoutId: workout.id,
        occurredAt,
        load: analysis.trainingLoad,
        intensityFactor: analysis.intensityFactor,
        algorithmVersion: TRAINING_LOAD_ALGORITHM_VERSION,
      },
      { transaction },
    );
  }

  async removeWorkoutLoad(workoutId: string, transaction?: Transaction): Promise<void> {
    await this.trainingLoadModel.destroy({ where: { workoutId }, transaction });
  }
}
