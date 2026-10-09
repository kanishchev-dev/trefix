import { RECORD_DISTANCES, type RecordDistance } from '../training.constants';
import { vdotFor } from './vdot';

const DAY_MS = 86_400_000;

/** A completed workout reduced to what progress needs. */
export interface WorkoutSample {
  id: string;
  date: Date;
  distanceKm: number;
  durationMinutes: number;
  averageHeartRate: number | null;
  type: string;
  title: string | null;
  provider: string | null;
  planId: string | null;
  excludeFromRecords: boolean;
  load: number;
}

export interface ResultSample {
  id: string;
  date: Date;
  distanceM: number;
  timeSeconds: number;
  kind: 'race' | 'workout' | 'test';
  name: string | null;
}

/** A performance usable for VDOT and records. */
export interface Effort {
  id: string;
  source: 'workout' | 'result';
  kind: 'race' | 'workout' | 'test';
  provider: string | null;
  date: Date;
  distanceM: number;
  timeSeconds: number;
  name: string | null;
  workoutId: string | null;
  resultId: string | null;
  vdot: number | null;
}

export const MIN_EFFORT_MINUTES = 10;
export const VDOT_WINDOW_DAYS = 90;

export function toEfforts(workouts: WorkoutSample[], results: ResultSample[]): Effort[] {
  const fromWorkouts: Effort[] = workouts
    .filter((workout) => !workout.excludeFromRecords && workout.distanceKm >= 1 && workout.durationMinutes > 0)
    .map((workout) => {
      const distanceM = Math.round(workout.distanceKm * 1000);
      const timeSeconds = Math.round(workout.durationMinutes * 60);
      return {
        id: `workout:${workout.id}`,
        source: 'workout',
        kind: workout.type === 'race' ? 'race' : 'workout',
        provider: workout.provider,
        date: workout.date,
        distanceM,
        timeSeconds,
        name: workout.title,
        workoutId: workout.id,
        resultId: null,
        vdot: plausiblePace(distanceM, timeSeconds) ? vdotFor(distanceM, timeSeconds) : null,
      };
    });
  const fromResults: Effort[] = results.map((result) => ({
    id: `result:${result.id}`,
    source: 'result',
    kind: result.kind,
    provider: null,
    date: result.date,
    distanceM: result.distanceM,
    timeSeconds: result.timeSeconds,
    name: result.name,
    workoutId: null,
    resultId: result.id,
    vdot: plausiblePace(result.distanceM, result.timeSeconds) ? vdotFor(result.distanceM, result.timeSeconds) : null,
  }));
  return [...fromWorkouts, ...fromResults].sort((left, right) => left.date.getTime() - right.date.getTime());
}

/** 2:30–15:00 per km; anything outside is a broken track. */
function plausiblePace(distanceM: number, timeSeconds: number): boolean {
  const pace = timeSeconds / (distanceM / 1000);
  return pace >= 150 && pace <= 900;
}

/** Best VDOT over the window ending at `at`, with the efforts that are within 10% of it. */
export function vdotAt(
  efforts: Effort[],
  at: Date,
  windowDays = VDOT_WINDOW_DAYS,
): { vdot: number | null; qualifying: Effort[] } {
  const from = at.getTime() - windowDays * DAY_MS;
  const candidates = efforts.filter(
    (effort) =>
      effort.vdot !== null &&
      effort.timeSeconds >= MIN_EFFORT_MINUTES * 60 &&
      effort.date.getTime() > from &&
      effort.date.getTime() <= at.getTime(),
  );
  if (candidates.length === 0) {
    return { vdot: null, qualifying: [] };
  }
  const best = Math.max(...candidates.map((effort) => effort.vdot as number));
  const qualifying = candidates
    .filter((effort) => (effort.vdot as number) >= best * 0.9)
    .sort((left, right) => (right.vdot as number) - (left.vdot as number));
  return { vdot: best, qualifying };
}

export type AccuracyLevel = 'high' | 'medium' | 'low';

export function accuracyOf(qualifyingCount: number): AccuracyLevel {
  if (qualifyingCount >= 8) return 'high';
  if (qualifyingCount >= 3) return 'medium';
  return 'low';
}

/** Fitness (42-day load / 6), fatigue (7-day load) and form, as the training engine computes them. */
export function formAt(
  loads: Array<{ date: Date; load: number }>,
  at: Date,
): { fitness: number; fatigue: number; form: number } {
  const end = at.getTime();
  const sum = (days: number): number =>
    loads
      .filter((entry) => entry.date.getTime() <= end && entry.date.getTime() > end - days * DAY_MS)
      .reduce((total, entry) => total + entry.load, 0);
  const fitness = sum(42) / 6;
  const fatigue = sum(7);
  return { fitness: Math.round(fitness), fatigue: Math.round(fatigue), form: Math.round(fitness - fatigue) };
}

export interface RecordEntry {
  distance: RecordDistance;
  seconds: number;
  date: Date;
  effort: Effort;
  isNew: boolean;
}

/**
 * Time an effort gives for a record distance: manual results must match the
 * distance (±1%); a whole workout counts when it is 0–10% longer (−2% for GPS)
 * and its time is scaled to the distance.
 */
export function timeForDistance(effort: Effort, distanceM: number): number | null {
  const ratio = effort.distanceM / distanceM;
  if (effort.source === 'result') {
    return Math.abs(ratio - 1) <= 0.01 ? effort.timeSeconds : null;
  }
  if (ratio < 0.98 || ratio > 1.1) {
    return null;
  }
  return Math.round(effort.timeSeconds / ratio);
}

export const NEW_RECORD_DAYS = 14;

export function bestRecords(efforts: Effort[], now: Date): Partial<Record<RecordDistance, RecordEntry>> {
  const result: Partial<Record<RecordDistance, RecordEntry>> = {};
  for (const [distance, meters] of Object.entries(RECORD_DISTANCES) as Array<[RecordDistance, number]>) {
    for (const effort of efforts) {
      if (effort.vdot === null) continue;
      const seconds = timeForDistance(effort, meters);
      if (seconds === null) continue;
      const current = result[distance];
      if (!current || seconds < current.seconds) {
        result[distance] = {
          distance,
          seconds,
          date: effort.date,
          effort,
          isNew: now.getTime() - effort.date.getTime() <= NEW_RECORD_DAYS * DAY_MS,
        };
      }
    }
  }
  return result;
}

export function attemptsFor(efforts: Effort[], distance: RecordDistance): Array<{ effort: Effort; seconds: number }> {
  const meters = RECORD_DISTANCES[distance];
  return efforts
    .filter((effort) => effort.vdot !== null)
    .map((effort) => ({ effort, seconds: timeForDistance(effort, meters) }))
    .filter((entry): entry is { effort: Effort; seconds: number } => entry.seconds !== null)
    .sort((left, right) => right.effort.date.getTime() - left.effort.date.getTime());
}

export type CapabilityType = 'endurance' | 'threshold' | 'speed' | 'recovery' | 'consistency';

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));
const vdotScore = (vdot: number): number => clampScore(((vdot - 25) / 45) * 100);

export interface CapabilityInput {
  workouts: WorkoutSample[];
  efforts: Effort[];
  loads: Array<{ date: Date; load: number }>;
  sessionsPerWeek: number;
  /** Planned plan workouts in the last 4 weeks: completed vs scheduled. */
  planAdherence: { planned: number; completed: number } | null;
}

/** Runner capabilities on a 0–100 scale at date `at`; `null` when there is nothing to base one on. */
export function capabilitiesAt(input: CapabilityInput, at: Date): Record<CapabilityType, number | null> {
  const end = at.getTime();
  const recent = (days: number): WorkoutSample[] =>
    input.workouts.filter((workout) => workout.date.getTime() <= end && workout.date.getTime() > end - days * DAY_MS);

  const last4 = recent(28);
  const weeklyKm = last4.reduce((sum, workout) => sum + workout.distanceKm, 0) / 4;
  const longest = last4.reduce((max, workout) => Math.max(max, workout.distanceKm), 0);
  const endurance =
    last4.length > 0 ? clampScore(50 * Math.min(1, weeklyKm / 60) + 50 * Math.min(1, longest / 25)) : null;

  const { vdot } = vdotAt(input.efforts, at);
  const threshold = vdot !== null ? vdotScore(vdot) : null;

  const shortEfforts = input.efforts.filter(
    (effort) =>
      effort.vdot !== null &&
      effort.distanceM >= 1000 &&
      effort.distanceM <= 6000 &&
      effort.date.getTime() <= end &&
      effort.date.getTime() > end - 90 * DAY_MS,
  );
  const speed =
    shortEfforts.length > 0
      ? vdotScore(Math.max(...shortEfforts.map((effort) => effort.vdot as number)))
      : threshold !== null
        ? clampScore(threshold - 5)
        : null;

  const form = formAt(input.loads, at);
  const recovery = input.loads.length > 0 ? clampScore(100 - form.fatigue + form.form * 0.5) : null;

  let consistency: number | null = null;
  if (input.planAdherence && input.planAdherence.planned > 0) {
    consistency = clampScore((input.planAdherence.completed / input.planAdherence.planned) * 100);
  } else if (input.workouts.length > 0) {
    const target = Math.max(1, input.sessionsPerWeek);
    let goodWeeks = 0;
    for (let week = 0; week < 8; week += 1) {
      const weekEnd = end - week * 7 * DAY_MS;
      const count = input.workouts.filter(
        (workout) => workout.date.getTime() <= weekEnd && workout.date.getTime() > weekEnd - 7 * DAY_MS,
      ).length;
      if (count >= target) goodWeeks += 1;
    }
    consistency = clampScore((goodWeeks / 8) * 100);
  }

  return { endurance, threshold, speed, recovery, consistency };
}

export function trendOf(now: number | null, before: number | null, tolerance = 2): 'up' | 'down' | 'stable' {
  if (now === null || before === null) return 'stable';
  if (now - before > tolerance) return 'up';
  if (before - now > tolerance) return 'down';
  return 'stable';
}

export type DynamicsMetric = 'distance' | 'pace' | 'heartRate' | 'load';
export type BucketSize = 'week' | 'month';

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - weekday * DAY_MS);
}

export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function bucketStarts(from: Date, to: Date, size: BucketSize): Date[] {
  const starts: Date[] = [];
  let cursor = size === 'week' ? weekStart(from) : monthStart(from);
  while (cursor.getTime() <= to.getTime()) {
    starts.push(cursor);
    cursor =
      size === 'week'
        ? new Date(cursor.getTime() + 7 * DAY_MS)
        : new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return starts;
}

function metricOf(workouts: WorkoutSample[], metric: DynamicsMetric): number | null {
  if (metric === 'distance') {
    return Math.round(workouts.reduce((sum, workout) => sum + workout.distanceKm, 0) * 10) / 10;
  }
  if (metric === 'load') {
    return Math.round(workouts.reduce((sum, workout) => sum + workout.load, 0));
  }
  if (metric === 'pace') {
    const distance = workouts.reduce((sum, workout) => sum + workout.distanceKm, 0);
    const time = workouts.reduce((sum, workout) => sum + workout.durationMinutes * 60, 0);
    return distance > 0 ? Math.round(time / distance) : null;
  }
  const withHr = workouts.filter((workout) => workout.averageHeartRate !== null);
  if (withHr.length === 0) return null;
  const minutes = withHr.reduce((sum, workout) => sum + workout.durationMinutes, 0);
  return Math.round(
    withHr.reduce((sum, workout) => sum + (workout.averageHeartRate as number) * workout.durationMinutes, 0) /
      Math.max(1, minutes),
  );
}

export interface DynamicsSeries {
  average: number | null;
  changePercent: number | null;
  points: Array<{ start: string; value: number | null }>;
}

/**
 * Per-bucket values over [from, to] and the change of the period average
 * against the previous period of the same length.
 */
export function dynamicsFor(
  workouts: WorkoutSample[],
  from: Date,
  to: Date,
  size: BucketSize,
  metric: DynamicsMetric,
): DynamicsSeries {
  const starts = bucketStarts(from, to, size);
  const bucketEnd = (index: number): number =>
    index + 1 < starts.length
      ? starts[index + 1].getTime()
      : size === 'week'
        ? starts[index].getTime() + 7 * DAY_MS
        : Date.UTC(starts[index].getUTCFullYear(), starts[index].getUTCMonth() + 1, 1);
  const points = starts.map((start, index) => {
    const inBucket = workouts.filter(
      (workout) => workout.date.getTime() >= start.getTime() && workout.date.getTime() < bucketEnd(index),
    );
    const value =
      inBucket.length > 0 ? metricOf(inBucket, metric) : metric === 'distance' || metric === 'load' ? 0 : null;
    return { start: start.toISOString().slice(0, 10), value };
  });

  const span = to.getTime() - from.getTime();
  const current = workouts.filter((workout) => workout.date >= from && workout.date <= to);
  const previous = workouts.filter(
    (workout) => workout.date.getTime() >= from.getTime() - span && workout.date.getTime() < from.getTime(),
  );
  const average = averageFor(current, metric, starts.length);
  const previousAverage = averageFor(previous, metric, starts.length);
  const changePercent =
    average !== null && previousAverage !== null && previousAverage !== 0
      ? Math.round(((average - previousAverage) / previousAverage) * 100)
      : null;
  return { average, changePercent, points };
}

function averageFor(workouts: WorkoutSample[], metric: DynamicsMetric, buckets: number): number | null {
  if (workouts.length === 0) return null;
  const total = metricOf(workouts, metric);
  if (total === null) return null;
  // Sums are shown per bucket; pace and heart rate are already averages.
  return metric === 'distance' || metric === 'load' ? Math.round((total / Math.max(1, buckets)) * 10) / 10 : total;
}

export interface Achievement {
  kind: 'longest_run' | 'streak' | 'new_record' | 'total_distance';
  value: number;
  date: string | null;
  distance?: RecordDistance;
}

const TOTAL_DISTANCE_MILESTONES = [100, 500, 1000, 2500, 5000];

export function achievementsFor(input: {
  allWorkouts: WorkoutSample[];
  records: Partial<Record<RecordDistance, RecordEntry>>;
  sessionsPerWeek: number;
  from: Date;
  now: Date;
}): Achievement[] {
  const achievements: Achievement[] = [];
  const longest = input.allWorkouts.reduce<WorkoutSample | null>(
    (best, workout) => (!best || workout.distanceKm > best.distanceKm ? workout : best),
    null,
  );
  if (longest && longest.distanceKm >= 3) {
    achievements.push({
      kind: 'longest_run',
      value: Math.round(longest.distanceKm * 10) / 10,
      date: longest.date.toISOString().slice(0, 10),
    });
  }

  // Consecutive weeks (ending with the last complete or current week) that met the session target.
  const target = Math.max(1, input.sessionsPerWeek);
  let streak = 0;
  let streakStart: Date | null = null;
  let cursor = weekStart(input.now);
  for (let guard = 0; guard < 104; guard += 1) {
    const count = input.allWorkouts.filter(
      (workout) => workout.date.getTime() >= cursor.getTime() && workout.date.getTime() < cursor.getTime() + 7 * DAY_MS,
    ).length;
    const isCurrentWeek = guard === 0;
    if (count >= target) {
      streak += 1;
      streakStart = cursor;
    } else if (!isCurrentWeek) {
      break;
    }
    cursor = new Date(cursor.getTime() - 7 * DAY_MS);
  }
  if (streak >= 2 && streakStart) {
    achievements.push({ kind: 'streak', value: streak, date: streakStart.toISOString().slice(0, 10) });
  }

  for (const record of Object.values(input.records)) {
    if (record && record.date >= input.from) {
      achievements.push({
        kind: 'new_record',
        value: record.seconds,
        date: record.date.toISOString().slice(0, 10),
        distance: record.distance,
      });
    }
  }

  const total = input.allWorkouts.reduce((sum, workout) => sum + workout.distanceKm, 0);
  const reached = TOTAL_DISTANCE_MILESTONES.filter((milestone) => total >= milestone).pop();
  if (reached) {
    let running = 0;
    let reachedAt: Date | null = null;
    for (const workout of [...input.allWorkouts].sort((left, right) => left.date.getTime() - right.date.getTime())) {
      running += workout.distanceKm;
      if (running >= reached) {
        reachedAt = workout.date;
        break;
      }
    }
    achievements.push({ kind: 'total_distance', value: reached, date: reachedAt?.toISOString().slice(0, 10) ?? null });
  }
  return achievements;
}
