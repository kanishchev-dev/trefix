import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { Athlete } from '../entities/athlete.entity';
import { RaceResult } from '../entities/race-result.entity';
import { Workout } from '../entities/workout.entity';
import { toWorkoutSample } from './progress.service';
import { type ResultSample, toEfforts } from './progress-calculations';
import { type RecordImprovement, recordTimeline } from './records-timeline';

/**
 * Chronology of an athlete's personal records for consumers outside the
 * training module (analytics keeps a log of when records were set).
 */
@Injectable()
export class RecordsTimelineService {
  constructor(
    @InjectModel(Athlete) private readonly athleteModel: typeof Athlete,
    @InjectModel(Workout) private readonly workoutModel: typeof Workout,
    @InjectModel(RaceResult) private readonly resultModel: typeof RaceResult,
  ) {}

  async timelineForAthlete(athleteId: string): Promise<RecordImprovement[]> {
    const [workouts, results] = await Promise.all([
      this.workoutModel.findAll({
        where: { athleteId, status: 'completed', sport: 'run' },
        attributes: [
          'id',
          'type',
          'target',
          'actual',
          'distanceKm',
          'durationMinutes',
          'completedAt',
          'scheduledAt',
          'sourceProvider',
          'planId',
          'excludeFromRecords',
        ],
      }),
      this.resultModel.findAll({ where: { athleteId } }),
    ]);
    const resultSamples: ResultSample[] = results.map((result) => ({
      id: result.id,
      date: new Date(`${result.date}T12:00:00Z`),
      distanceM: result.distanceM,
      timeSeconds: result.timeSeconds,
      kind: result.kind,
      name: result.name,
    }));
    const samples = workouts.map((workout) => toWorkoutSample(workout, 0));
    return recordTimeline(toEfforts(samples, resultSamples));
  }

  /** Athlete of a user, or null before the athlete profile exists. */
  async athleteIdOfUser(userId: string): Promise<string | null> {
    const athlete = await this.athleteModel.findOne({ where: { userId }, attributes: ['id'] });
    return athlete?.id ?? null;
  }
}
