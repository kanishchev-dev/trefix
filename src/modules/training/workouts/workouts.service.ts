import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';

import { DomainBadRequestException, DomainConflictException } from '@/common/exceptions/domain-exceptions';
import { emitAfterCommit } from '@/common/utils/transaction-events.util';

import { AdaptationsService } from '../adaptations/adaptations.service';
import { AthleteStateService } from '../athletes/athlete-state.service';
import { AthletesService } from '../athletes/athletes.service';
import { AnalyzeWorkoutDto } from '../dto/analyze-workout.dto';
import { CompleteWorkoutDto } from '../dto/complete-workout.dto';
import { CreateWorkoutDto } from '../dto/create-workout.dto';
import { Workout } from '../entities/workout.entity';
import { WorkoutCompletedEvent } from '../events/workout-completed.event';
import { WorkoutCreatedEvent } from '../events/workout-created.event';
import {
  AdaptationEventView,
  AthleteStateView,
  WorkoutAnalysisView,
  WorkoutView,
} from '../interfaces/training-views.interface';
import { TrainingEngine } from '../training.engine';
import { TRAINING_EVENTS } from '../training.events';
import { toWorkoutAnalysisView, toWorkoutView } from '../training.mappers';
import { TrainingLookupService } from '../training-lookup.service';

export interface WorkoutCompletionResult {
  workout: WorkoutView;
  analysis: WorkoutAnalysisView;
  state: AthleteStateView;
  adaptation: AdaptationEventView;
}

/** Defaults of a manually logged workout when the user leaves fields empty. */
const MANUAL_WORKOUT_DEFAULTS = {
  type: 'easy',
  durationMinutes: 30,
  distanceKm: 5,
  source: 'manual',
} as const;
const RECENT_WORKOUTS_DEFAULT_LIMIT = 10;

/** The athlete's own workouts: logging, completion and calendar reads. */
@Injectable()
export class WorkoutsService {
  constructor(
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly lookup: TrainingLookupService,
    private readonly athletes: AthletesService,
    private readonly athleteState: AthleteStateService,
    private readonly adaptations: AdaptationsService,
    private readonly trainingEngine: TrainingEngine,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Returns a workout if it belongs to the authenticated user. */
  async getWorkout(id: string, actorUserId: string): Promise<WorkoutView> {
    const workout = await this.lookup.workout(id);
    await this.lookup.ownedAthlete(workout.athleteId, actorUserId);
    return toWorkoutView(workout);
  }

  /** Most recent workouts of the authenticated athlete. */
  async listRecentWorkoutsForAthlete(
    athleteId: string,
    actorUserId: string,
    limit = RECENT_WORKOUTS_DEFAULT_LIMIT,
  ): Promise<WorkoutView[]> {
    await this.lookup.ownedAthlete(athleteId, actorUserId);
    const workouts = await this.workoutModel.findAll({
      where: { athleteId },
      order: [
        ['scheduledAt', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
    });
    return workouts.map((workout) => toWorkoutView(workout));
  }

  /** Calendar of the authenticated athlete; dates are inclusive whole days. */
  async listWorkoutsForDateRange(
    actorUserId: string,
    fromStr?: string,
    toStr?: string,
    includeCancelled = false,
  ): Promise<WorkoutView[]> {
    const athlete = await this.athletes.getOrCreateAthlete(actorUserId);

    const where: WhereOptions<Workout> & Record<string, unknown> = { athleteId: athlete.id };
    // Cancelled workouts (cancelled plans / moves) stay out of Today unless history asks for them.
    if (!includeCancelled) {
      where.status = { [Op.ne]: 'cancelled' };
    }
    if (fromStr || toStr) {
      const scheduledAt: Record<symbol, Date> = {};
      if (fromStr) {
        const fromDate = new Date(fromStr);
        fromDate.setHours(0, 0, 0, 0);
        scheduledAt[Op.gte] = fromDate;
      }
      if (toStr) {
        const toDate = new Date(toStr);
        toDate.setHours(23, 59, 59, 999);
        scheduledAt[Op.lte] = toDate;
      }
      where.scheduledAt = scheduledAt;
    }

    const workouts = await this.workoutModel.findAll({
      where,
      order: [
        ['scheduledAt', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
    return workouts.map((workout) => toWorkoutView(workout));
  }

  /** Logs a workout outside any plan: planned for a future day, or already completed. */
  async createWorkout(actorUserId: string, dto: CreateWorkoutDto): Promise<WorkoutView> {
    const athlete = await this.lookup.athlete((await this.athletes.getOrCreateAthlete(actorUserId)).id);

    const scheduledDate = new Date(dto.scheduledAt);
    const isCompleted = dto.status === 'completed' || dto.actualDistanceKm !== undefined;
    const status = isCompleted ? 'completed' : dto.status || 'planned';
    if (status === 'planned' && scheduledDate <= this.endOfToday()) {
      throw new DomainBadRequestException('INVALID_DATE', 'A planned workout can only be added for a future date');
    }

    const workoutType = dto.type || MANUAL_WORKOUT_DEFAULTS.type;
    const durationMinutes =
      dto.durationMinutes ?? (dto.actualDurationMinutes || MANUAL_WORKOUT_DEFAULTS.durationMinutes);
    const distanceKm = dto.distanceKm ?? (dto.actualDistanceKm || MANUAL_WORKOUT_DEFAULTS.distanceKm);
    const source = dto.source || MANUAL_WORKOUT_DEFAULTS.source;

    return this.workoutModel.sequelize!.transaction(async (transaction) => {
      const workout = await this.workoutModel.create(
        {
          athleteId: athlete.id,
          goalId: null,
          planId: null,
          weekNumber: 1,
          scheduledAt: scheduledDate,
          type: workoutType,
          phase: 'adhoc',
          status,
          orderInWeek: 1,
          durationMinutes,
          distanceKm,
          // No generated title or description: clients name the workout by its
          // type in the app language; only text provided by the caller is kept.
          target: {
            ...(dto.title ? { title: dto.title } : {}),
            ...(dto.description ? { description: dto.description } : {}),
            source,
          },
          steps: [],
          actual: null,
          analysis: null,
          completedAt: isCompleted ? new Date() : null,
          sourceProvider: source,
        },
        { transaction },
      );
      emitAfterCommit(
        this.eventEmitter,
        transaction,
        TRAINING_EVENTS.WORKOUT_CREATED,
        new WorkoutCreatedEvent(athlete.id, workout.id, null, actorUserId),
      );

      if (!isCompleted) {
        return toWorkoutView(workout);
      }

      const actualDurationMinutes = dto.actualDurationMinutes ?? durationMinutes;
      const actualDistanceKm = dto.actualDistanceKm ?? distanceKm;
      const analysisResult = this.trainingEngine.analyzeWorkout({
        plannedWorkout: toWorkoutView(workout),
        actualDurationMinutes,
        actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
        actualAverageHeartRate: dto.actualAverageHeartRate,
        rpe: dto.rpe,
      });

      workout.actual = {
        actualDurationMinutes,
        actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm ?? null,
        actualAverageHeartRate: dto.actualAverageHeartRate ?? null,
        rpe: dto.rpe ?? null,
        notes: dto.notes ?? null,
      };
      workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
      await workout.save({ transaction });

      const loadRecord = await this.athleteState.recordWorkoutLoad(athlete.id, workout, analysisResult, transaction);
      await this.athleteState.recalculate(athlete.id, transaction);
      emitAfterCommit(
        this.eventEmitter,
        transaction,
        TRAINING_EVENTS.WORKOUT_COMPLETED,
        new WorkoutCompletedEvent(athlete.id, workout.id, loadRecord.load),
      );
      return toWorkoutView(workout);
    });
  }

  /** Analyses a workout's planned target against the facts in the request, without storing anything. */
  async analyzeWorkout(actorUserId: string, dto: AnalyzeWorkoutDto): Promise<WorkoutAnalysisView> {
    const workout = await this.lookup.workout(dto.workoutId);
    await this.lookup.ownedAthlete(workout.athleteId, actorUserId);

    return this.trainingEngine.analyzeWorkout({
      plannedWorkout: toWorkoutView(workout),
      actualDurationMinutes: dto.actualDurationMinutes,
      actualDistanceKm: dto.actualDistanceKm,
      actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
      actualAverageHeartRate: dto.actualAverageHeartRate,
      rpe: dto.rpe,
    }).analysis;
  }

  /**
   * Records the fact of a completed workout. Allowed for planned workouts in
   * any plan status — including history plans — because this records a fact
   * rather than editing the plan. Cancelled and skipped workouts stay blocked:
   * that run is logged as a separate workout.
   *
   * The workout, its load, the new state and the adaptation are written in one
   * transaction with the workout row locked, so a retried or double-tapped
   * request completes the workout once.
   */
  async completeWorkout(
    actorUserId: string,
    workoutId: string,
    dto: CompleteWorkoutDto,
  ): Promise<WorkoutCompletionResult> {
    const athlete = await this.lookup.ownedAthlete((await this.lookup.workout(workoutId)).athleteId, actorUserId);

    return this.workoutModel.sequelize!.transaction(async (transaction) => {
      const workout = await this.lookup.workoutForUpdate(workoutId, transaction);
      this.ensureCompletable(workout);

      if (workout.status === 'completed' && workout.analysis) {
        return {
          workout: toWorkoutView(workout),
          analysis: toWorkoutAnalysisView(workout.analysis),
          state: await this.athleteState.latest(athlete.id),
          adaptation: await this.adaptations.latestForWorkout(athlete, workout),
        };
      }

      const analysisResult = this.trainingEngine.analyzeWorkout({
        plannedWorkout: toWorkoutView(workout),
        actualDurationMinutes: dto.actualDurationMinutes,
        actualDistanceKm: dto.actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
        actualAverageHeartRate: dto.actualAverageHeartRate,
        rpe: dto.rpe,
      });

      workout.status = 'completed';
      workout.actual = {
        actualDurationMinutes: dto.actualDurationMinutes,
        actualDistanceKm: dto.actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm ?? null,
        actualAverageHeartRate: dto.actualAverageHeartRate ?? null,
        rpe: dto.rpe ?? null,
        notes: dto.notes ?? null,
      };
      workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
      workout.completedAt = new Date();
      await workout.save({ transaction });

      const loadRecord = await this.athleteState.recordWorkoutLoad(athlete.id, workout, analysisResult, transaction);
      const state = await this.athleteState.recalculate(athlete.id, transaction);
      const adaptation = await this.adaptations.decideAndApply(
        athlete,
        workout,
        analysisResult.analysis,
        state,
        { origin: 'automatic' },
        transaction,
      );

      emitAfterCommit(
        this.eventEmitter,
        transaction,
        TRAINING_EVENTS.WORKOUT_COMPLETED,
        new WorkoutCompletedEvent(athlete.id, workout.id, loadRecord.load),
      );
      return { workout: toWorkoutView(workout), analysis: analysisResult.analysis, state, adaptation };
    });
  }

  private ensureCompletable(workout: Workout): void {
    if (workout.status === 'cancelled') {
      throw new DomainConflictException(
        'WORKOUT_CANCELLED',
        'A cancelled workout cannot be marked as completed; log it as a separate workout instead',
      );
    }
    if (workout.status === 'skipped') {
      throw new DomainConflictException('WORKOUT_LOCKED', 'A skipped workout cannot be marked as completed');
    }
  }

  private endOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }
}
