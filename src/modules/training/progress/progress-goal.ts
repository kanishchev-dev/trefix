import type { GoalView } from '../interfaces/training-views.interface';
import { type Effort, timeForDistance, vdotAt } from './progress-calculations';
import { predictSeconds } from './vdot';

const DAY_MS = 86_400_000;
const LEGACY_DISTANCE_M: Record<string, number> = {
  '5k': 5000,
  '10k': 10000,
  half_marathon: 21097.5,
  marathon: 42195,
};
/** The projection never assumes more than 1% improvement per week. */
const MAX_WEEKLY_GAIN = 0.01;

export type GoalStatus = 'achieved' | 'on_track' | 'behind' | 'no_data' | 'no_forecast';

export interface GoalProgress {
  id: string;
  type: string;
  date: string | null;
  weeksLeft: number | null;
  distanceKm: number | null;
  targetSeconds: number | null;
  forecastSeconds: number | null;
  status: GoalStatus;
  series: Array<{ date: string; seconds: number }>;
  projection: Array<{ date: string; seconds: number }>;
}

/** Distance and target time of a race-family goal (universal payload first, then legacy columns). */
export function raceTarget(goal: GoalView): { distanceM: number; targetSeconds: number | null } | null {
  const target = goal.payload?.target ?? {};
  const distanceM =
    typeof target.distanceMeters === 'number' ? target.distanceMeters : LEGACY_DISTANCE_M[goal.raceDistance];
  if (!distanceM) return null;
  const targetSeconds =
    typeof target.finishTimeSec === 'number' ? target.finishTimeSec : (goal.targetTimeSeconds ?? null);
  return { distanceM, targetSeconds };
}

export function goalProgress(goal: GoalView, efforts: Effort[], from: Date, now: Date): GoalProgress {
  const targetDate = goal.targetDate ? new Date(`${goal.targetDate}T00:00:00Z`) : null;
  const weeksLeft = targetDate ? Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (7 * DAY_MS))) : null;
  const base: GoalProgress = {
    id: goal.id,
    type: goal.type,
    date: goal.targetDate,
    weeksLeft,
    distanceKm: null,
    targetSeconds: null,
    forecastSeconds: null,
    status: 'no_forecast',
    series: [],
    projection: [],
  };
  const race = raceTarget(goal);
  if (!race) return base;

  base.distanceKm = Math.round(race.distanceM / 100) / 10;
  base.targetSeconds = race.targetSeconds;

  // Weekly forecast over the period.
  const series: Array<{ date: string; seconds: number }> = [];
  for (let at = from.getTime() + 7 * DAY_MS; at <= now.getTime(); at += 7 * DAY_MS) {
    const { vdot } = vdotAt(efforts, new Date(at));
    if (vdot !== null)
      series.push({ date: new Date(at).toISOString().slice(0, 10), seconds: predictSeconds(vdot, race.distanceM) });
  }
  const { vdot } = vdotAt(efforts, now);
  if (vdot === null) {
    return { ...base, status: 'no_data', series };
  }
  const forecast = predictSeconds(vdot, race.distanceM);
  series.push({ date: now.toISOString().slice(0, 10), seconds: forecast });
  base.forecastSeconds = forecast;
  base.series = dedupeByDate(series);

  const bestOnDistance = efforts
    .map((effort) => timeForDistance(effort, race.distanceM))
    .filter((seconds): seconds is number => seconds !== null);
  if (race.targetSeconds !== null && bestOnDistance.some((seconds) => seconds <= (race.targetSeconds as number))) {
    return { ...base, status: 'achieved' };
  }
  if (race.targetSeconds === null) {
    return { ...base, status: 'no_forecast' };
  }

  // Linear trend of the last 8 weeks, capped, projected to the goal date.
  const eightWeeksAgo = vdotAt(efforts, new Date(now.getTime() - 56 * DAY_MS)).vdot;
  const before = eightWeeksAgo !== null ? predictSeconds(eightWeeksAgo, race.distanceM) : forecast;
  const weeklyChange = Math.max((before - forecast) / 8, 0);
  const cappedGain = Math.min(weeklyChange, forecast * MAX_WEEKLY_GAIN);
  const projected = weeksLeft !== null ? Math.round(forecast - cappedGain * weeksLeft) : forecast;
  if (targetDate && weeksLeft !== null && weeksLeft > 0) {
    base.projection = [
      { date: now.toISOString().slice(0, 10), seconds: forecast },
      { date: goal.targetDate as string, seconds: projected },
    ];
  }
  return { ...base, status: projected <= race.targetSeconds ? 'on_track' : 'behind' };
}

function dedupeByDate(points: Array<{ date: string; seconds: number }>): Array<{ date: string; seconds: number }> {
  const byDate = new Map<string, number>();
  for (const point of points) byDate.set(point.date, point.seconds);
  return [...byDate.entries()].map(([date, seconds]) => ({ date, seconds }));
}
