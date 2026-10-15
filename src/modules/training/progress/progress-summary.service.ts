import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { toGoalView } from '@/modules/training/training.mappers';

import { calculateHrZones } from '../athletes/hr-zones';
import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { RaceResult } from '../entities/race-result.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { resolveTimezone, todayIsoInTz } from '../plans/plan-utils';
import { toWorkoutSample } from './progress.service';
import { type ResultSample, toEfforts } from './progress-calculations';
import { raceTarget } from './progress-goal';
import { buildProgressSummary, type SummaryPlanWorkoutSample, type SummaryWorkoutSample } from './progress-summary';
import { type ProgressSummaryView, type SummaryWorkoutType } from './progress-summary.views';

const DAY_MS = 86_400_000;
const WORKOUT_ATTRIBUTES = [
  'id',
  'type',
  'status',
  'target',
  'actual',
  'distanceKm',
  'durationMinutes',
  'completedAt',
  'scheduledAt',
  'sourceProvider',
  'planId',
  'excludeFromRecords',
];

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Facts of the athlete's history for the Progress screen: totals, comparisons, plan completion, trends. */
@Injectable()
export class ProgressSummaryService {
  constructor(
    @InjectModel(Athlete) private readonly athleteModel: typeof Athlete,
    @InjectModel(Workout) private readonly workoutModel: typeof Workout,
    @InjectModel(RaceResult) private readonly resultModel: typeof RaceResult,
    @InjectModel(TrainingPlan) private readonly planModel: typeof TrainingPlan,
    @InjectModel(AthleteGoal) private readonly goalModel: typeof AthleteGoal,
    private readonly athletesService: AthletesService,
  ) {}

  /** Summary as of today in the athlete's timezone (UTC when unknown). */
  async summary(userId: string, timezone?: string | null, now = new Date()): Promise<ProgressSummaryView> {
    const view = await this.athletesService.getOrCreateAthlete(userId);
    const athlete = await this.athleteModel.findByPk(view.id);
    if (!athlete) {
      throw new DomainNotFoundException('ATHLETE_NOT_FOUND', 'The user has no athlete profile yet');
    }
    const tz = resolveTimezone(timezone);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const localDate = (date: Date): string => formatter.format(date);

    const [completed, results, plan] = await Promise.all([
      this.workoutModel.findAll({
        where: { athleteId: athlete.id, status: 'completed', type: { [Op.ne]: 'rest' } },
        attributes: WORKOUT_ATTRIBUTES,
      }),
      this.resultModel.findAll({ where: { athleteId: athlete.id } }),
      this.planModel.findOne({ where: { athleteId: athlete.id, status: 'active' } }),
    ]);

    const resultSamples: ResultSample[] = results.map((result) => ({
      id: result.id,
      date: new Date(`${result.date}T12:00:00Z`),
      distanceM: result.distanceM,
      timeSeconds: result.timeSeconds,
      kind: result.kind,
      name: result.name,
    }));
    const efforts = toEfforts(
      completed.map((workout) => toWorkoutSample(workout, 0)),
      resultSamples,
    );

    return buildProgressSummary({
      today: todayIsoInTz(tz),
      workouts: completed.map((workout) => toSummaryWorkout(workout, localDate)),
      plan: plan ? await this.planInput(plan, localDate) : null,
      goal: plan ? await this.goalInput(plan) : null,
      efforts,
      localDate,
      now,
      hrZoneBounds: zoneBounds(athlete),
    });
  }

  private async planInput(
    plan: TrainingPlan,
    localDate: (date: Date) => string,
  ): Promise<{ startDate: string; totalWeeks: number; workouts: SummaryPlanWorkoutSample[] } | null> {
    if (!plan.startDate) return null;
    const rows = await this.workoutModel.findAll({
      where: { planId: plan.id, type: { [Op.ne]: 'rest' }, status: { [Op.ne]: 'cancelled' } },
      attributes: WORKOUT_ATTRIBUTES,
      order: [['scheduledAt', 'ASC']],
    });
    const totalWeeks = plan.endDate
      ? Math.max(1, Math.ceil((Date.parse(plan.endDate) - Date.parse(plan.startDate) + DAY_MS) / (7 * DAY_MS)))
      : Math.max(1, plan.weeks?.length ?? 1);
    return {
      startDate: plan.startDate,
      totalWeeks,
      workouts: rows.map((row) => {
        const actual = (row.actual ?? {}) as Record<string, unknown>;
        const target = (row.target ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          date: localDate(row.scheduledAt),
          type: row.type as SummaryWorkoutType,
          done: row.status === 'completed',
          plannedKm: row.distanceKm ?? 0,
          actualKm: num(actual.actualDistanceKm),
          actualDurationMin: num(actual.actualDurationMinutes),
          paceMinSec: num(target.paceMinSecondsPerKm),
          paceMaxSec: num(target.paceMaxSecondsPerKm),
        };
      }),
    };
  }

  /** Only a race goal with a target time has a "best vs target" to show. */
  private async goalInput(
    plan: TrainingPlan,
  ): Promise<{ distanceM: number; targetSec: number; raceDate: string } | null> {
    if (!plan.goalId) return null;
    const goal = await this.goalModel.findByPk(plan.goalId);
    if (!goal?.targetDate) return null;
    const race = raceTarget(toGoalView(goal));
    if (!race || race.targetSeconds === null) return null;
    return { distanceM: race.distanceM, targetSec: race.targetSeconds, raceDate: goal.targetDate };
  }
}

function toSummaryWorkout(workout: Workout, localDate: (date: Date) => string): SummaryWorkoutSample {
  const actual = (workout.actual ?? {}) as Record<string, unknown>;
  return {
    id: workout.id,
    date: localDate(workout.completedAt ?? workout.scheduledAt),
    type: workout.type as SummaryWorkoutType,
    planned: workout.planId !== null,
    distanceKm: num(actual.actualDistanceKm) ?? workout.distanceKm ?? 0,
    durationMin: num(actual.actualDurationMinutes) ?? workout.durationMinutes ?? null,
    avgHeartRate: num(actual.actualAverageHeartRate),
    elevationM: num(actual.elevationGainMeters),
  };
}

/** Upper bounds of Z1–Z4 from the athlete's zone settings. */
function zoneBounds(athlete: Athlete): number[] | null {
  const { zones } = calculateHrZones({
    method: athlete.hrZonesMethod,
    restingHeartRate: athlete.restingHeartRate,
    maxHeartRate: athlete.maxHeartRate,
    thresholdHeartRate: athlete.thresholdHeartRate,
    customUpperBounds: athlete.hrZonesCustom,
  });
  if (!zones) return null;
  const bounds = zones.slice(0, 4).map((zone) => zone.max);
  return bounds.every((bound): bound is number => bound !== null) ? bounds : null;
}
