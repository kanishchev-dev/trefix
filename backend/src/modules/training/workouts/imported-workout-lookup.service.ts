import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { Workout } from '../entities/workout.entity';
import { WorkoutView } from '../interfaces/training-views.interface';
import { toWorkoutView } from '../training.mappers';

/** Half-open UTC range `[from, toExclusive)`, usually one local calendar day. */
export interface WorkoutTimeRange {
  from: Date;
  toExclusive: Date;
}

/**
 * Read-only port for matching imported activities to workouts: which workout
 * a new run belongs to, whether a linked workout still exists.
 */
@Injectable()
export class ImportedWorkoutLookupService {
  constructor(
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
  ) {}

  async findWorkout(id: string): Promise<WorkoutView | null> {
    const workout = await this.workoutModel.findByPk(id);
    return workout ? toWorkoutView(workout) : null;
  }

  /** False after the user deleted the workout (soft-deleted rows do not count). */
  async workoutExists(id: string): Promise<boolean> {
    return (await this.workoutModel.count({ where: { id } })) > 0;
  }

  /** The athlete's workout, or null when the id belongs to someone else. */
  async findAthleteWorkout(athleteId: string, workoutId: string): Promise<WorkoutView | null> {
    const workout = await this.workoutModel.findOne({ where: { id: workoutId, athleteId } });
    return workout ? toWorkoutView(workout) : null;
  }

  /** A specific planned workout, provided it is still open and dated within the range. */
  async findOpenPlanned(athleteId: string, workoutId: string, range: WorkoutTimeRange): Promise<WorkoutView | null> {
    const workout = await this.workoutModel.findOne({
      where: {
        id: workoutId,
        athleteId,
        status: 'planned',
        scheduledAt: { [Op.gte]: range.from, [Op.lt]: range.toExclusive },
      },
    });
    return workout ? toWorkoutView(workout) : null;
  }

  async listPlanned(athleteId: string, range: WorkoutTimeRange): Promise<WorkoutView[]> {
    const workouts = await this.workoutModel.findAll({
      where: { athleteId, status: 'planned', scheduledAt: { [Op.gte]: range.from, [Op.lt]: range.toExclusive } },
    });
    return workouts.map((workout) => toWorkoutView(workout));
  }

  /** Completed workouts not delivered by any of the given import sources, i.e. closed by hand. */
  async listManuallyCompleted(
    athleteId: string,
    range: WorkoutTimeRange,
    importedSources: readonly string[],
  ): Promise<WorkoutView[]> {
    const workouts = await this.workoutModel.findAll({
      where: {
        athleteId,
        status: 'completed',
        scheduledAt: { [Op.gte]: range.from, [Op.lt]: range.toExclusive },
        [Op.or]: [{ sourceProvider: null }, { sourceProvider: { [Op.notIn]: [...importedSources] } }],
      },
    });
    return workouts.map((workout) => toWorkoutView(workout));
  }
}
