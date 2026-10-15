import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { DomainBadRequestException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { GoalView } from '@/modules/training/interfaces/training-views.interface';
import { TRAINING_EVENTS } from '@/modules/training/training.events';
import { toGoalView } from '@/modules/training/training.mappers';

import { estimateMaxHeartRate } from '../athletes/hr-zones';
import { ageFromBirthDate } from '../athletes/profile-completeness';
import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { RaceResult } from '../entities/race-result.entity';
import { TrainingLoad } from '../entities/training-load.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { todayIsoInTz } from '../plans/plan-utils';
import {
  PROGRESS_METRICS_MIN_WORKOUTS,
  type ProgressMetric,
  type ProgressPeriodKey,
  RECORD_DISTANCES,
  type RecordDistance,
} from '../training.constants';
import { CreateResultDto } from './dto/progress.dto';
import {
  type ProgressMetricView,
  type ProgressOverviewView,
  type RaceResultView,
  type RecordHistoryView,
  type RecordsExclusionView,
  type RecordView,
} from './progress.views';
import {
  accuracyOf,
  achievementsFor,
  attemptsFor,
  bestRecords,
  type BucketSize,
  capabilitiesAt,
  type CapabilityType,
  dynamicsFor,
  type DynamicsMetric,
  type Effort,
  formAt,
  type RecordEntry,
  type ResultSample,
  toEfforts,
  trendOf,
  vdotAt,
  type WorkoutSample,
} from './progress-calculations';
import { goalProgress } from './progress-goal';
import { predictSeconds, thresholdPace, trainingPaces } from './vdot';

const DAY_MS = 86_400_000;
const CAPABILITY_ORDER: CapabilityType[] = ['endurance', 'threshold', 'speed', 'recovery', 'consistency'];
const DYNAMICS_METRICS: DynamicsMetric[] = ['distance', 'pace', 'heartRate', 'load'];
const PREDICTED_DISTANCES: RecordDistance[] = ['5k', '10k', 'half_marathon'];

export class ProgressUpdatedEvent {
  constructor(public readonly userId: string) {}
}

interface AthleteData {
  athlete: Athlete;
  workouts: WorkoutSample[];
  results: ResultSample[];
  efforts: Effort[];
  loads: Array<{ date: Date; load: number }>;
}

/** Computed progress of the athlete: forecasts, form, capabilities, records, dynamics, achievements. */
@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(Athlete) private readonly athleteModel: typeof Athlete,
    @InjectModel(Workout) private readonly workoutModel: typeof Workout,
    @InjectModel(TrainingLoad) private readonly loadModel: typeof TrainingLoad,
    @InjectModel(RaceResult) private readonly resultModel: typeof RaceResult,
    @InjectModel(TrainingPlan) private readonly planModel: typeof TrainingPlan,
    @InjectModel(AthleteGoal) private readonly goalModel: typeof AthleteGoal,
    private readonly athletesService: AthletesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async overview(userId: string, periodKey: ProgressPeriodKey, now = new Date()): Promise<ProgressOverviewView> {
    const data = await this.load(userId);
    const { from, bucket } = periodRange(periodKey, now);
    const recentCount = data.workouts.filter((workout) => workout.date.getTime() > now.getTime() - 42 * DAY_MS).length;
    const unlocked = recentCount >= PROGRESS_METRICS_MIN_WORKOUTS;

    const goal = await this.resolveGoal(data.athlete.id);
    const { vdot } = vdotAt(data.efforts, now);
    const vdotBefore = vdotAt(data.efforts, from).vdot;

    const formNow = formAt(data.loads, now);
    const formBefore = formAt(data.loads, from);
    const planAdherence = await this.planAdherence(data.athlete.id, now);
    const capabilityInput = {
      workouts: data.workouts,
      efforts: data.efforts,
      loads: data.loads,
      sessionsPerWeek: data.athlete.sessionsPerWeek,
      planAdherence,
    };
    const capsNow = capabilitiesAt(capabilityInput, now);
    const capsBefore = capabilitiesAt({ ...capabilityInput, planAdherence: null }, from);
    const records = bestRecords(data.efforts, now);

    const dynamics = Object.fromEntries(
      DYNAMICS_METRICS.map((metric) => [metric, dynamicsFor(data.workouts, from, now, bucket, metric)]),
    ) as Record<DynamicsMetric, ReturnType<typeof dynamicsFor>>;
    const weeksInPeriod = Math.max(1, (now.getTime() - from.getTime()) / (7 * DAY_MS));
    const actualWeeklyKm =
      Math.round(
        (data.workouts.filter((workout) => workout.date >= from).reduce((sum, workout) => sum + workout.distanceKm, 0) /
          weeksInPeriod) *
          10,
      ) / 10;
    const profileKm = data.athlete.weeklyMileageKm;
    const profileVolumeHint =
      profileKm && actualWeeklyKm > 0 && Math.abs(actualWeeklyKm - profileKm) / profileKm > 0.1
        ? { profileKm, actualKm: actualWeeklyKm }
        : null;

    return {
      period: { key: periodKey, from: isoDate(from), to: isoDate(now) },
      metricsUnlock: { required: PROGRESS_METRICS_MIN_WORKOUTS, completed: recentCount, unlocked },
      goal: goal ? { ...goalProgress(goal.view, data.efforts, from, now), planName: goal.planName } : null,
      predictions:
        vdot !== null
          ? PREDICTED_DISTANCES.map((distance) => ({
              distance,
              seconds: predictSeconds(vdot, RECORD_DISTANCES[distance]),
            }))
          : [],
      predictionBasis: vdotAt(data.efforts, now).qualifying.length,
      form: unlocked
        ? { ...formNow, fitnessChange: formNow.fitness - formBefore.fitness, changeWeeks: Math.round(weeksInPeriod) }
        : null,
      metrics: {
        thresholdPace:
          unlocked && vdot !== null
            ? {
                value: thresholdPace(vdot),
                change: vdotBefore !== null ? thresholdPace(vdot) - thresholdPace(vdotBefore) : null,
              }
            : null,
        vo2max:
          unlocked && vdot !== null
            ? {
                value: Math.round(vdot),
                change: vdotBefore !== null ? Math.round(vdot) - Math.round(vdotBefore) : null,
              }
            : null,
        thresholdHeartRate: this.thresholdHeartRate(data.athlete),
      },
      capabilities: unlocked
        ? CAPABILITY_ORDER.map((type) => ({
            type,
            value: capsNow[type],
            trend: trendOf(capsNow[type], capsBefore[type]),
          }))
        : null,
      records: (Object.keys(RECORD_DISTANCES) as RecordDistance[])
        .filter((distance) => distance !== '1k')
        .map((distance) => recordView(distance, records[distance] ?? null)),
      dynamics: { bucket, metrics: dynamics, profileVolumeHint },
      achievements: achievementsFor({
        allWorkouts: data.workouts,
        records,
        sessionsPerWeek: data.athlete.sessionsPerWeek,
        from,
        now,
      }),
    };
  }

  async metric(
    userId: string,
    metric: ProgressMetric,
    periodKey: ProgressPeriodKey,
    now = new Date(),
  ): Promise<ProgressMetricView> {
    const data = await this.load(userId);
    const { from } = periodRange(periodKey, now);
    const current = vdotAt(data.efforts, now);
    if (current.vdot === null) {
      return { metric, value: null, change: null, updatedAt: null, series: [], accuracy: { level: 'low', efforts: 0 } };
    }
    const toValue = (vdot: number): number => (metric === 'threshold_pace' ? thresholdPace(vdot) : Math.round(vdot));
    const series: Array<{ date: string; value: number }> = [];
    for (let at = from.getTime(); at <= now.getTime(); at += 7 * DAY_MS) {
      const { vdot } = vdotAt(data.efforts, new Date(at));
      if (vdot !== null) series.push({ date: isoDate(new Date(at)), value: toValue(vdot) });
    }
    series.push({ date: isoDate(now), value: toValue(current.vdot) });
    const before = vdotAt(data.efforts, from).vdot;
    const workoutsById = new Map(data.workouts.map((workout) => [workout.id, workout]));
    const athlete = data.athlete;

    return {
      metric,
      value: toValue(current.vdot),
      change: before !== null ? toValue(current.vdot) - toValue(before) : null,
      updatedAt: current.qualifying.reduce<Date | null>(
        (latest, effort) => (!latest || effort.date > latest ? effort.date : latest),
        null,
      ),
      series: dedupeSeries(series),
      accuracy: { level: accuracyOf(current.qualifying.length), efforts: current.qualifying.length },
      zones: {
        method: athlete.hrZonesMethod,
        maxHeartRate: athlete.maxHeartRate,
        thresholdHeartRate: athlete.thresholdHeartRate,
      },
      paces: trainingPaces(current.vdot),
      topEfforts: current.qualifying.slice(0, 3).map((effort) => ({
        id: effort.id,
        workoutId: effort.workoutId,
        resultId: effort.resultId,
        title: effort.name ?? (effort.workoutId ? (workoutsById.get(effort.workoutId)?.type ?? null) : null),
        workoutType: effort.workoutId ? (workoutsById.get(effort.workoutId)?.type ?? null) : null,
        date: isoDate(effort.date),
        distanceKm: Math.round(effort.distanceM / 100) / 10,
        paceSecondsPerKm: Math.round(effort.timeSeconds / (effort.distanceM / 1000)),
      })),
    };
  }

  async records(userId: string, now = new Date()): Promise<{ items: RecordView[] }> {
    const data = await this.load(userId);
    const records = bestRecords(data.efforts, now);
    const { vdot } = vdotAt(data.efforts, now);
    return {
      items: (Object.keys(RECORD_DISTANCES) as RecordDistance[]).map((distance) => ({
        ...recordView(distance, records[distance] ?? null),
        predictionSeconds: vdot !== null ? predictSeconds(vdot, RECORD_DISTANCES[distance]) : null,
      })),
    };
  }

  async recordHistory(userId: string, distance: RecordDistance): Promise<RecordHistoryView> {
    if (!(distance in RECORD_DISTANCES)) {
      throw new DomainBadRequestException('PROGRESS_DISTANCE_UNKNOWN', 'Unknown record distance');
    }
    const data = await this.load(userId);
    return {
      distance,
      attempts: attemptsFor(data.efforts, distance).map(({ effort, seconds }) => ({
        id: effort.id,
        source: effort.source,
        kind: effort.kind,
        provider: effort.provider,
        name: effort.name,
        date: isoDate(effort.date),
        seconds,
        workoutId: effort.workoutId,
        resultId: effort.resultId,
      })),
    };
  }

  async addResult(userId: string, dto: CreateResultDto): Promise<RaceResultView> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const pace = dto.timeSeconds / (dto.distanceM / 1000);
    if (pace < 150 || pace > 900) {
      throw new DomainBadRequestException('RESULT_INVALID', 'The pace of this result is not realistic');
    }
    if (dto.date > todayIsoInTz('UTC')) {
      throw new DomainBadRequestException('RESULT_INVALID', 'A result cannot be in the future');
    }
    const result = await this.resultModel.create({
      athleteId: athlete.id,
      distanceM: dto.distanceM,
      timeSeconds: dto.timeSeconds,
      date: dto.date,
      kind: dto.kind,
      name: dto.name?.trim() || null,
    });
    this.eventEmitter.emit(TRAINING_EVENTS.PROGRESS_UPDATED, new ProgressUpdatedEvent(userId));
    return {
      id: result.id,
      distanceM: result.distanceM,
      timeSeconds: result.timeSeconds,
      date: result.date,
      kind: result.kind,
      name: result.name,
    };
  }

  async deleteResult(userId: string, resultId: string): Promise<void> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const result = await this.resultModel.findOne({ where: { id: resultId, athleteId: athlete.id } });
    if (!result) {
      throw new DomainNotFoundException('RESULT_NOT_FOUND', 'Result not found');
    }
    await result.destroy();
    this.eventEmitter.emit(TRAINING_EVENTS.PROGRESS_UPDATED, new ProgressUpdatedEvent(userId));
  }

  async setRecordsExcluded(userId: string, workoutId: string, excluded: boolean): Promise<RecordsExclusionView> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const workout = await this.workoutModel.findOne({ where: { id: workoutId, athleteId: athlete.id } });
    if (!workout) {
      throw new DomainNotFoundException('WORKOUT_NOT_FOUND', 'Workout not found');
    }
    workout.excludeFromRecords = excluded;
    await workout.save();
    this.eventEmitter.emit(TRAINING_EVENTS.PROGRESS_UPDATED, new ProgressUpdatedEvent(userId));
    return { workoutId, excluded };
  }

  private async load(userId: string): Promise<AthleteData> {
    const view = await this.athletesService.getOrCreateAthlete(userId);
    const athlete = await this.athleteModel.findByPk(view.id);
    if (!athlete) {
      throw new DomainNotFoundException('ATHLETE_NOT_FOUND', 'The user has no athlete profile yet');
    }
    const [workouts, loads, results] = await Promise.all([
      this.workoutModel.findAll({
        where: { athleteId: athlete.id, status: 'completed' },
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
      this.loadModel.findAll({ where: { athleteId: athlete.id }, attributes: ['workoutId', 'occurredAt', 'load'] }),
      this.resultModel.findAll({ where: { athleteId: athlete.id } }),
    ]);
    const loadByWorkout = new Map(
      loads.filter((entry) => entry.workoutId).map((entry) => [entry.workoutId as string, entry.load]),
    );
    const workoutSamples = workouts.map((workout) => toWorkoutSample(workout, loadByWorkout.get(workout.id) ?? 0));
    const resultSamples: ResultSample[] = results.map((result) => ({
      id: result.id,
      date: new Date(`${result.date}T12:00:00Z`),
      distanceM: result.distanceM,
      timeSeconds: result.timeSeconds,
      kind: result.kind,
      name: result.name,
    }));
    return {
      athlete,
      workouts: workoutSamples,
      results: resultSamples,
      efforts: toEfforts(workoutSamples, resultSamples),
      loads: loads.map((entry) => ({ date: entry.occurredAt, load: Number(entry.load) || 0 })),
    };
  }

  /** The goal of the active plan, otherwise the latest active goal. */
  private async resolveGoal(athleteId: string): Promise<{ view: GoalView; planName: string | null } | null> {
    const plan = await this.planModel.findOne({ where: { athleteId, status: 'active' } });
    let goal = plan?.goalId ? await this.goalModel.findByPk(plan.goalId) : null;
    if (!goal) {
      goal = await this.goalModel.findOne({ where: { athleteId, status: 'active' }, order: [['createdAt', 'DESC']] });
    }
    if (!goal) return null;
    return { view: toGoalView(goal), planName: plan?.name ?? null };
  }

  /** Completed vs scheduled workouts of the active plan in the last 4 weeks. */
  private async planAdherence(athleteId: string, now: Date): Promise<{ planned: number; completed: number } | null> {
    const plan = await this.planModel.findOne({ where: { athleteId, status: 'active' }, attributes: ['id'] });
    if (!plan) return null;
    const scheduled = await this.workoutModel.findAll({
      where: {
        planId: plan.id,
        scheduledAt: { [Op.gte]: new Date(now.getTime() - 28 * DAY_MS), [Op.lt]: now },
        type: { [Op.ne]: 'rest' },
      },
      attributes: ['status'],
    });
    if (scheduled.length === 0) return null;
    return {
      planned: scheduled.length,
      completed: scheduled.filter((workout) => workout.status === 'completed').length,
    };
  }

  private thresholdHeartRate(athlete: Athlete): { value: number; estimated: boolean } | null {
    if (athlete.thresholdHeartRate) return { value: athlete.thresholdHeartRate, estimated: false };
    const age = ageFromBirthDate(athlete.birthDate, todayIsoInTz('UTC')) ?? athlete.age;
    const max = athlete.maxHeartRate ?? estimateMaxHeartRate(age);
    return max ? { value: Math.round(max * 0.9), estimated: true } : null;
  }
}

export function toWorkoutSample(workout: Workout, load: number): WorkoutSample {
  const actual = (workout.actual ?? {}) as Record<string, unknown>;
  const target = (workout.target ?? {}) as Record<string, unknown>;
  const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  return {
    id: workout.id,
    date: workout.completedAt ?? workout.scheduledAt,
    distanceKm: num(actual.actualDistanceKm) ?? workout.distanceKm ?? 0,
    durationMinutes: num(actual.actualDurationMinutes) ?? workout.durationMinutes ?? 0,
    averageHeartRate: num(actual.actualAverageHeartRate),
    type: workout.type,
    title: typeof target.title === 'string' ? target.title : null,
    provider: workout.sourceProvider ?? null,
    planId: workout.planId,
    excludeFromRecords: Boolean(workout.excludeFromRecords),
    load,
  };
}

function recordView(distance: RecordDistance, record: RecordEntry | null): RecordView {
  return {
    distance,
    best: record
      ? {
          seconds: record.seconds,
          date: isoDate(record.date),
          source: record.effort.source,
          kind: record.effort.kind,
          provider: record.effort.provider,
          name: record.effort.name,
          isNew: record.isNew,
          workoutId: record.effort.workoutId,
          resultId: record.effort.resultId,
        }
      : null,
  };
}

export function periodRange(key: ProgressPeriodKey, now: Date): { from: Date; bucket: BucketSize } {
  const from = new Date(now);
  if (key === '4W') from.setUTCDate(from.getUTCDate() - 28);
  else if (key === '8W') from.setUTCDate(from.getUTCDate() - 56);
  else if (key === '3M') from.setUTCMonth(from.getUTCMonth() - 3);
  else if (key === '6M') from.setUTCMonth(from.getUTCMonth() - 6);
  else from.setUTCFullYear(from.getUTCFullYear() - 1);
  return { from, bucket: key === '1Y' ? 'month' : 'week' };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dedupeSeries(points: Array<{ date: string; value: number }>): Array<{ date: string; value: number }> {
  const byDate = new Map<string, number>();
  for (const point of points) byDate.set(point.date, point.value);
  return [...byDate.entries()].map(([date, value]) => ({ date, value }));
}
