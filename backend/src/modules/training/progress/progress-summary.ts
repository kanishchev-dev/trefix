import { RECORD_DISTANCES, type RecordDistance } from '../training.constants';
import { attemptsFor, bestRecords, type Effort, timeForDistance } from './progress-calculations';
import {
  type ProgressSummaryView,
  type SummaryAnalyticsView,
  type SummaryComparisonView,
  type SummaryGoalView,
  type SummaryMonthView,
  type SummaryPaceType,
  type SummaryPlanExecutionView,
  type SummaryPlanKeyWorkoutView,
  type SummaryPlanView,
  type SummaryRegularityDay,
  type SummaryTotalsView,
  type SummaryWorkoutType,
  type SummaryWorkoutView,
  type SummaryYearView,
} from './progress-summary.views';

/**
 * Pure maths of the progress summary. Everything works on local calendar days
 * (YYYY-MM-DD) so week, month and year boundaries match what the athlete sees.
 */

/** A completed workout (rest days excluded). */
export interface SummaryWorkoutSample {
  id: string;
  date: string;
  type: SummaryWorkoutType;
  /** Belongs to a plan (any plan, not only the active one). */
  planned: boolean;
  distanceKm: number;
  durationMin: number | null;
  avgHeartRate: number | null;
  elevationM: number | null;
}

/** A workout row of the active plan (rest days and cancelled rows excluded). */
export interface SummaryPlanWorkoutSample {
  id: string;
  date: string;
  type: SummaryWorkoutType;
  done: boolean;
  plannedKm: number;
  actualKm: number | null;
  actualDurationMin: number | null;
  paceMinSec: number | null;
  paceMaxSec: number | null;
}

export interface SummaryInput {
  today: string;
  workouts: SummaryWorkoutSample[];
  plan: { startDate: string; totalWeeks: number; workouts: SummaryPlanWorkoutSample[] } | null;
  /** Race goal of the active plan with a target time. */
  goal: { distanceM: number; targetSec: number; raceDate: string } | null;
  efforts: Effort[];
  /** Local calendar day of an effort or record timestamp. */
  localDate: (date: Date) => string;
  now: Date;
  /** Upper bounds of Z1–Z4, bpm; null when the athlete's zones are unknown. */
  hrZoneBounds: number[] | null;
}

/** Completed workouts in the last 42 days needed before the analytics opens. */
export const SUMMARY_ANALYTICS_MIN_WORKOUTS = 6;
const ANALYTICS_WINDOW_DAYS = 42;
const PACE_MONTHS = 4;
const LOAD_WEEKS = 7;
const REGULARITY_WEEKS = 4;
const VOLUME_WEEKS = 6;
const FORM_EFFORTS = 5;
const KEY_WORKOUTS_LIMIT = 6;
/** An easy-pace change below this is noise, seconds per km. */
const EASY_PACE_MIN_GAIN_SEC = 5;
/** Heart rate counts as "the same" within this many bpm. */
const SAME_HEART_RATE_BPM = 3;
/** Week-over-week volume growth above this is a jump, percent. */
const VOLUME_MAX_GROWTH_PCT = 10;
const KEY_TYPES: ReadonlySet<SummaryWorkoutType> = new Set([
  'long_run',
  'tempo',
  'threshold',
  'interval',
  'hill',
  'race',
]);
const PACE_GROUPS: Record<SummaryPaceType, ReadonlySet<SummaryWorkoutType>> = {
  easy: new Set(['easy', 'recovery']),
  tempo: new Set(['tempo', 'threshold']),
  interval: new Set(['interval', 'hill']),
};

// --- calendar helpers -------------------------------------------------------

function parts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month: month - 1, day };
}

function toIso(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parts(iso);
  return toIso(year, month, day + days);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Monday of the week containing `iso`. */
export function weekStartOf(iso: string): string {
  const { year, month, day } = parts(iso);
  const weekday = (new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7;
  return toIso(year, month, day - weekday);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const inRange = (date: string, from: string, to: string): boolean => date >= from && date <= to;

// --- aggregation ------------------------------------------------------------

function totalsOf(workouts: SummaryWorkoutSample[]): SummaryTotalsView {
  const elevations = workouts.map((workout) => workout.elevationM).filter((value): value is number => value !== null);
  return {
    distanceKm: round1(workouts.reduce((sum, workout) => sum + workout.distanceKm, 0)),
    durationMin: Math.round(workouts.reduce((sum, workout) => sum + (workout.durationMin ?? 0), 0)),
    elevationM: elevations.length > 0 ? Math.round(elevations.reduce((sum, value) => sum + value, 0)) : null,
    count: workouts.length,
  };
}

/** Duration-weighted average heart rate of the workouts that measured it. */
function avgHeartRate(workouts: SummaryWorkoutSample[]): number | null {
  const measured = workouts.filter((workout) => workout.avgHeartRate !== null && (workout.durationMin ?? 0) > 0);
  const minutes = measured.reduce((sum, workout) => sum + (workout.durationMin ?? 0), 0);
  if (minutes === 0) return null;
  return Math.round(
    measured.reduce((sum, workout) => sum + (workout.avgHeartRate ?? 0) * (workout.durationMin ?? 0), 0) / minutes,
  );
}

/** Pace over the workouts that have both distance and time; 0 when there are none. */
function avgPace(workouts: SummaryWorkoutSample[]): number {
  const timed = workouts.filter((workout) => workout.durationMin !== null && workout.distanceKm > 0);
  const km = timed.reduce((sum, workout) => sum + workout.distanceKm, 0);
  if (km === 0) return 0;
  return Math.round((timed.reduce((sum, workout) => sum + (workout.durationMin ?? 0), 0) * 60) / km);
}

function comparisonOf(workouts: SummaryWorkoutSample[]): SummaryComparisonView {
  return {
    totals: totalsOf(workouts),
    longestKm: round1(Math.max(0, ...workouts.map((workout) => workout.distanceKm))),
    avgHeartRate: avgHeartRate(workouts),
    avgPaceSecPerKm: avgPace(workouts),
  };
}

/** The same stretch of the previous week, month and year: an unfinished period is compared fairly. */
function comparisons(today: string, workouts: SummaryWorkoutSample[]): ProgressSummaryView['comparison'] {
  const between = (from: string, to: string): SummaryWorkoutSample[] =>
    workouts.filter((workout) => inRange(workout.date, from, to));
  const weekStart = weekStartOf(today);
  const previousWeekStart = addDays(weekStart, -7);
  const { year, month, day } = parts(today);
  const previousMonth = new Date(Date.UTC(year, month - 1, 1));
  const pmYear = previousMonth.getUTCFullYear();
  const pmMonth = previousMonth.getUTCMonth();
  const pmDay = Math.min(day, daysInMonth(pmYear, pmMonth));
  const pyDay = Math.min(day, daysInMonth(year - 1, month));
  return {
    week: comparisonOf(between(previousWeekStart, addDays(previousWeekStart, daysBetween(weekStart, today)))),
    month: comparisonOf(between(toIso(pmYear, pmMonth, 1), toIso(pmYear, pmMonth, pmDay))),
    year: comparisonOf(between(toIso(year - 1, 0, 1), toIso(year - 1, month, pyDay))),
  };
}

function monthsOf(today: string, workouts: SummaryWorkoutSample[]): SummaryMonthView[] {
  const { year, month } = parts(today);
  return Array.from({ length: month }, (_, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, '0')}-`;
    return { year, month: index, ...totalsOf(workouts.filter((workout) => workout.date.startsWith(prefix))) };
  });
}

function yearsOf(today: string, workouts: SummaryWorkoutSample[], firstDate: string | null): SummaryYearView[] {
  if (!firstDate) return [];
  const current = parts(today).year;
  const first = parts(firstDate).year;
  const years: SummaryYearView[] = [];
  for (let year = first; year < current; year += 1) {
    years.push({ year, ...totalsOf(workouts.filter((workout) => workout.date.startsWith(`${year}-`))) });
  }
  return years;
}

// --- records ----------------------------------------------------------------

function recordHolders(efforts: Effort[], now: Date): Map<string, number> {
  const holders = new Map<string, number>();
  const records = bestRecords(efforts, now);
  for (const [distance, entry] of Object.entries(records) as Array<
    [RecordDistance, NonNullable<(typeof records)[RecordDistance]>]
  >) {
    const workoutId = entry.effort.workoutId;
    if (!workoutId || distance === '1k') continue;
    const km = RECORD_DISTANCES[distance] / 1000;
    holders.set(workoutId, Math.max(holders.get(workoutId) ?? 0, km));
  }
  return holders;
}

function recordsInYear(input: SummaryInput): number {
  const year = String(parts(input.today).year);
  const records = bestRecords(input.efforts, input.now);
  return (Object.entries(records) as Array<[RecordDistance, { date: Date }]>).filter(
    ([distance, entry]) => distance !== '1k' && input.localDate(entry.date).startsWith(year),
  ).length;
}

function goalOf(input: SummaryInput): SummaryGoalView | null {
  if (!input.goal) return null;
  const { distanceM, targetSec, raceDate } = input.goal;
  let best: SummaryGoalView['best'] = null;
  for (const effort of input.efforts) {
    if (effort.vdot === null) continue;
    const seconds = timeForDistance(effort, distanceM);
    if (seconds !== null && (!best || seconds < best.seconds)) {
      best = { seconds, date: input.localDate(effort.date) };
    }
  }
  return { distanceKm: round1(distanceM / 1000), targetSec, raceDate, best };
}

// --- plan -------------------------------------------------------------------

function isMissed(row: SummaryPlanWorkoutSample, today: string): boolean {
  return !row.done && row.date < today;
}

function executionOf(
  rows: SummaryPlanWorkoutSample[],
  workouts: SummaryWorkoutSample[],
  from: string,
  to: string,
  today: string,
): SummaryPlanExecutionView {
  const scoped = rows.filter((row) => inRange(row.date, from, to));
  const done = scoped.filter((row) => row.done && row.date <= today);
  const missed = scoped.filter((row) => isMissed(row, today));
  const due = [...done, ...missed];
  return {
    done: done.length,
    due: due.length,
    upcoming: scoped.filter((row) => !row.done && row.date >= today).length,
    plannedKm: round1(due.reduce((sum, row) => sum + row.plannedKm, 0)),
    actualKm: round1(done.reduce((sum, row) => sum + (row.actualKm ?? row.plannedKm), 0)),
    offPlanKm: round1(
      workouts
        .filter((workout) => !workout.planned && inRange(workout.date, from, today))
        .reduce((sum, workout) => sum + workout.distanceKm, 0),
    ),
  };
}

function planOf(input: SummaryInput): SummaryPlanView | null {
  const plan = input.plan;
  if (!plan) return null;
  const { today } = input;
  const { year, month } = parts(today);
  const max = (left: string, right: string): string => (left > right ? left : right);
  const weekStart = weekStartOf(today);
  const monthStart = toIso(year, month, 1);
  const planEnd = addDays(plan.startDate, plan.totalWeeks * 7 - 1);
  const currentWeek = Math.min(plan.totalWeeks, Math.max(1, Math.floor(daysBetween(plan.startDate, today) / 7) + 1));
  return {
    startDate: plan.startDate,
    currentWeek,
    totalWeeks: plan.totalWeeks,
    execution: {
      week: executionOf(plan.workouts, input.workouts, max(weekStart, plan.startDate), addDays(weekStart, 6), today),
      month: executionOf(
        plan.workouts,
        input.workouts,
        max(monthStart, plan.startDate),
        toIso(year, month, daysInMonth(year, month)),
        today,
      ),
      sinceStart: executionOf(plan.workouts, input.workouts, plan.startDate, planEnd, today),
    },
  };
}

// --- analytics --------------------------------------------------------------

function formOf(input: SummaryInput): SummaryAnalyticsView['form'] {
  // Only races and time trials: a regular workout is not a test of form.
  const series = (distance: RecordDistance): Array<{ date: string; seconds: number }> =>
    attemptsFor(input.efforts, distance)
      .filter(({ effort }) => effort.kind !== 'workout')
      .slice(0, FORM_EFFORTS)
      .reverse()
      .map(({ effort, seconds }) => ({ date: input.localDate(effort.date), seconds }));
  return { '5': series('5k'), '10': series('10k') };
}

function recentMonths(today: string, count: number): Array<{ year: number; month: number }> {
  const { year, month } = parts(today);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - (count - 1 - index), 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
  });
}

function inMonth(workout: SummaryWorkoutSample, year: number, month: number): boolean {
  return workout.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`);
}

function paceOf(input: SummaryInput): SummaryAnalyticsView['pace'] {
  const months = recentMonths(input.today, PACE_MONTHS);
  const series = (type: SummaryPaceType): Array<{ month: number; secPerKm: number }> =>
    months
      .map(({ year, month }) => {
        const pace = avgPace(
          input.workouts.filter((workout) => PACE_GROUPS[type].has(workout.type) && inMonth(workout, year, month)),
        );
        return { month, secPerKm: pace };
      })
      .filter((point) => point.secPerKm > 0);
  return { easy: series('easy'), tempo: series('tempo'), interval: series('interval') };
}

/**
 * Share of time in zones for the current month. Each workout is placed in the
 * zone of its average heart rate: an approximation until per-second data exists.
 */
function zonesOf(input: SummaryInput, monthWorkouts: SummaryWorkoutSample[]): number[] | null {
  const bounds = input.hrZoneBounds;
  if (!bounds) return null;
  const minutes = [0, 0, 0, 0, 0];
  for (const workout of monthWorkouts) {
    if (workout.avgHeartRate === null || !workout.durationMin) continue;
    const zone = bounds.findIndex((upper) => (workout.avgHeartRate as number) <= upper);
    minutes[zone === -1 ? 4 : zone] += workout.durationMin;
  }
  const total = minutes.reduce((sum, value) => sum + value, 0);
  if (total === 0) return null;
  return minutes.map((value) => Math.round((value / total) * 100));
}

function weeklyKmOf(input: SummaryInput): SummaryAnalyticsView['weeklyKm'] {
  const current = weekStartOf(input.today);
  return Array.from({ length: LOAD_WEEKS }, (_, index) => {
    const weekStart = addDays(current, -7 * (LOAD_WEEKS - 1 - index));
    const km = input.workouts
      .filter((workout) => inRange(workout.date, weekStart, addDays(weekStart, 6)))
      .reduce((sum, workout) => sum + workout.distanceKm, 0);
    return { weekStart, km: round1(km), partial: weekStart === current };
  });
}

function regularityOf(input: SummaryInput): SummaryAnalyticsView['regularity'] {
  const runDays = new Set(input.workouts.map((workout) => workout.date));
  const missedDays = new Set(
    (input.plan?.workouts ?? []).filter((row) => isMissed(row, input.today)).map((row) => row.date),
  );
  const current = weekStartOf(input.today);
  return Array.from({ length: REGULARITY_WEEKS }, (_, index) => {
    const weekStart = addDays(current, -7 * (REGULARITY_WEEKS - 1 - index));
    const days = Array.from({ length: 7 }, (_, offset): SummaryRegularityDay => {
      const date = addDays(weekStart, offset);
      if (date > input.today) return 'future';
      if (runDays.has(date)) return 'run';
      return missedDays.has(date) ? 'missed' : 'rest';
    });
    return { weekStart, days };
  });
}

function keyWorkoutsOf(input: SummaryInput): SummaryPlanKeyWorkoutView[] {
  if (!input.plan) return [];
  const { year, month } = parts(input.today);
  const monthStart = toIso(year, month, 1);
  return input.plan.workouts
    .filter((row) => inRange(row.date, monthStart, input.today))
    .filter((row) => (row.done && KEY_TYPES.has(row.type)) || isMissed(row, input.today))
    .slice(-KEY_WORKOUTS_LIMIT)
    .map((row): SummaryPlanKeyWorkoutView => {
      const byPace = row.type !== 'long_run' && row.paceMinSec !== null && row.paceMaxSec !== null;
      const planned: SummaryPlanKeyWorkoutView['planned'] = byPace
        ? { kind: 'pace', fromSec: row.paceMinSec as number, toSec: row.paceMaxSec as number }
        : { kind: 'distance', km: round1(row.plannedKm) };
      let actual: SummaryPlanKeyWorkoutView['actual'] = null;
      if (row.done) {
        const km = row.actualKm ?? row.plannedKm;
        actual =
          byPace && row.actualDurationMin && km > 0
            ? { kind: 'pace', sec: Math.round((row.actualDurationMin * 60) / km) }
            : { kind: 'distance', km: round1(km) };
      }
      return { type: row.type, date: row.date, planned, actual };
    });
}

function easyPaceInsight(input: SummaryInput): SummaryAnalyticsView['insights'][number] | null {
  const months = recentMonths(input.today, PACE_MONTHS)
    .map(({ year, month }) =>
      input.workouts.filter((workout) => PACE_GROUPS.easy.has(workout.type) && inMonth(workout, year, month)),
    )
    .filter((group) => avgPace(group) > 0);
  if (months.length < 2) return null;
  const first = months[0];
  const last = months[months.length - 1];
  const gain = avgPace(first) - avgPace(last);
  if (gain < EASY_PACE_MIN_GAIN_SEC) return null;
  const hrBefore = avgHeartRate(first);
  const hrAfter = avgHeartRate(last);
  return {
    code: 'easy_pace_faster',
    params: { seconds: Math.round(gain), workouts: months.reduce((sum, group) => sum + group.length, 0) },
    usesHeartRate: hrBefore !== null && hrAfter !== null && Math.abs(hrAfter - hrBefore) <= SAME_HEART_RATE_BPM,
  };
}

function volumeInsight(input: SummaryInput): SummaryAnalyticsView['insights'][number] | null {
  const current = weekStartOf(input.today);
  const weeks = Array.from({ length: VOLUME_WEEKS }, (_, index) => {
    const weekStart = addDays(current, -7 * (VOLUME_WEEKS - index));
    return input.workouts
      .filter((workout) => inRange(workout.date, weekStart, addDays(weekStart, 6)))
      .reduce((sum, workout) => sum + workout.distanceKm, 0);
  });
  if (weeks.some((km) => km === 0)) return null;
  const changes = weeks.slice(1).map((km, index) => ((km - weeks[index]) / weeks[index]) * 100);
  const min = Math.min(...changes);
  const max = Math.max(...changes);
  if (min < 0 || max > VOLUME_MAX_GROWTH_PCT || max === 0) return null;
  return {
    code: 'volume_steady',
    params: { min: Math.round(min), max: Math.round(max), weeks: VOLUME_WEEKS },
    usesHeartRate: false,
  };
}

function analyticsOf(input: SummaryInput): SummaryAnalyticsView {
  const { year, month } = parts(input.today);
  const monthWorkouts = input.workouts.filter((workout) => inMonth(workout, year, month));
  const recent = input.workouts.filter((workout) => daysBetween(workout.date, input.today) < ANALYTICS_WINDOW_DAYS);
  const insights = [easyPaceInsight(input), volumeInsight(input)].filter(
    (insight): insight is NonNullable<typeof insight> => insight !== null,
  );
  return {
    available: recent.length >= SUMMARY_ANALYTICS_MIN_WORKOUTS,
    form: formOf(input),
    pace: paceOf(input),
    heartRateZones: zonesOf(input, monthWorkouts),
    avgHeartRate: avgHeartRate(monthWorkouts),
    weeklyKm: weeklyKmOf(input),
    regularity: regularityOf(input),
    planKeyWorkouts: keyWorkoutsOf(input),
    insights,
  };
}

// --- summary ----------------------------------------------------------------

/** Detailed workouts from the start of the current month or week, whichever is earlier, newest first. */
function recentWorkouts(input: SummaryInput, holders: Map<string, number>): SummaryWorkoutView[] {
  const { year, month } = parts(input.today);
  const monthStart = toIso(year, month, 1);
  const weekStart = weekStartOf(input.today);
  const from = weekStart < monthStart ? weekStart : monthStart;
  const done: SummaryWorkoutView[] = input.workouts
    .filter((workout) => inRange(workout.date, from, input.today))
    .map((workout) => ({
      id: workout.id,
      date: workout.date,
      type: workout.type,
      status: workout.planned ? 'plan' : 'free',
      distanceKm: round1(workout.distanceKm),
      durationMin: workout.durationMin !== null ? round1(workout.durationMin) : null,
      avgHeartRate: workout.avgHeartRate,
      elevationM: workout.elevationM,
      recordDistanceKm: holders.get(workout.id) ?? null,
    }));
  const missed: SummaryWorkoutView[] = (input.plan?.workouts ?? [])
    .filter((row) => inRange(row.date, from, input.today) && isMissed(row, input.today))
    .map((row) => ({
      id: null,
      date: row.date,
      type: row.type,
      status: 'missed',
      distanceKm: round1(row.plannedKm),
      durationMin: null,
      avgHeartRate: null,
      elevationM: null,
      recordDistanceKm: null,
    }));
  return [...done, ...missed].sort((left, right) => right.date.localeCompare(left.date));
}

function longestRunOf(input: SummaryInput): ProgressSummaryView['longestRun'] {
  const year = String(parts(input.today).year);
  const thisYear = input.workouts.filter((workout) => workout.date.startsWith(year));
  if (thisYear.length === 0) return null;
  const longest = thisYear.reduce((best, workout) => (workout.distanceKm > best.distanceKm ? workout : best));
  const before = input.workouts.filter((workout) => workout.date < `${year}-01-01`);
  return {
    distanceKm: round1(longest.distanceKm),
    date: longest.date,
    previousKm: before.length > 0 ? round1(Math.max(...before.map((workout) => workout.distanceKm))) : null,
  };
}

export function buildProgressSummary(input: SummaryInput): ProgressSummaryView {
  const workouts = input.workouts.filter((workout) => workout.date <= input.today);
  const scoped = { ...input, workouts };
  const firstWorkoutDate = workouts.reduce<string | null>(
    (first, workout) => (!first || workout.date < first ? workout.date : first),
    null,
  );
  return {
    asOf: input.today,
    workouts: recentWorkouts(scoped, recordHolders(input.efforts, input.now)),
    months: monthsOf(input.today, workouts),
    years: yearsOf(input.today, workouts, firstWorkoutDate),
    firstWorkoutDate,
    comparison: comparisons(input.today, workouts),
    longestRun: longestRunOf(scoped),
    recordsThisYear: recordsInYear(scoped),
    goal: goalOf(scoped),
    plan: planOf(scoped),
    analytics: analyticsOf(scoped),
  };
}
