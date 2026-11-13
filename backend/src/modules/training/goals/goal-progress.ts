import { type AthleteGoalCategory, type AthleteGoalType, GOAL_TYPE_CATEGORY } from '../goal-taxonomy';

/**
 * How far an athlete is from a goal, judged by the goal's category. Most goal
 * types have no finish line, so "achieved" means the measurable target from
 * the payload was reached (or, without one, a sensible default habit).
 */

export const GOAL_PROGRESS_STATUSES = ['achieved', 'on_track', 'at_risk', 'missed', 'abandoned', 'no_data'] as const;
export type GoalProgressStatus = (typeof GOAL_PROGRESS_STATUSES)[number];

/** Share of planned workouts done over 4 weeks that counts as "on track". */
export const GOAL_ON_TRACK_ADHERENCE = 0.75;
/** Improvement of a performance metric that counts as reaching an intent-only goal. */
export const GOAL_IMPROVEMENT_PCT = 3;
/** A race result counts for the goal distance within this tolerance. */
export const GOAL_RACE_DISTANCE_TOLERANCE = 0.03;
/** Days after the target date a race may still be logged. */
export const GOAL_RACE_GRACE_DAYS = 7;
/** Weekly target met in this many of the last 4 weeks reaches a habit goal. */
export const GOAL_HABIT_WEEKS_REQUIRED = 3;
/** Default habit when the goal has no numeric target: runs a week. */
export const GOAL_DEFAULT_RUNS_PER_WEEK = 2;
/** Weeks a maintenance goal must hold its habit. */
export const GOAL_MAINTAIN_WEEKS = 8;
/** Shortest run whose pace counts for pace goals, km. */
export const GOAL_MIN_PACE_RUN_KM = 3;

export interface GoalWeekFacts {
  runs: number;
  km: number;
  minutes: number;
}

export interface GoalPlanFacts {
  status: string;
  cancelReason: string | null;
  /** Completed / (completed + skipped) over the last 4 weeks; null without planned workouts. */
  adherence: number | null;
  /** Share of the plan's duration already behind, 0..1. */
  elapsedShare: number;
}

export interface GoalFacts {
  goalType: string;
  goalStatus: string;
  target: Record<string, unknown>;
  current: Record<string, unknown>;
  /** Distance of a race goal in metres (payload or legacy column). */
  raceDistanceM: number | null;
  /** Target finish time of a race goal in seconds. */
  targetTimeSeconds: number | null;
  targetDate: string | null;
  today: string;
  /** Rolling 7-day windows, index 0 ends today; 8 entries. */
  weeks: GoalWeekFacts[];
  /** Longest single run since the goal was set. */
  longestRun: { minutes: number; km: number };
  /** Same, over the last 14 days. */
  longestRecentRun: { minutes: number; km: number };
  /** Best average pace of runs ≥ the qualifying distance since the goal was set, s/km. */
  bestPaceSecPerKm: number | null;
  /** Best race on the goal distance (or the plan's race workout) since the goal was set. */
  race: { timeSeconds: number; date: string } | null;
  plan: GoalPlanFacts | null;
  thresholdPace: { start: number | null; latest: number | null };
  fitness: { start: number | null; latest: number | null };
  weightKg: number | null;
  /** Value of the challenge metric over its period, and the elapsed share of the period (null if open). */
  challenge: { value: number; elapsedShare: number | null } | null;
  hasWorkouts: boolean;
}

export interface GoalProgress {
  category: AthleteGoalCategory;
  status: GoalProgressStatus;
  progressPct: number | null;
  current: number | null;
  target: number | null;
}

interface Measure {
  achieved: boolean;
  /** A finished attempt that fell short (a race run slower than the target). */
  failedAttempt?: boolean;
  progressPct: number | null;
  current: number | null;
  target: number | null;
  /** Category-specific "on track" verdict; null falls back to plan adherence / regularity. */
  onTrack: boolean | null;
}

const DAY_MS = 86_400_000;

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pct(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function averageRuns(weeks: readonly GoalWeekFacts[], count: number): number {
  const slice = weeks.slice(0, count);
  return slice.length === 0 ? 0 : slice.reduce((sum, week) => sum + week.runs, 0) / slice.length;
}

function fallbackOnTrack(facts: GoalFacts): boolean {
  if (facts.plan?.adherence !== null && facts.plan?.adherence !== undefined) {
    return facts.plan.adherence >= GOAL_ON_TRACK_ADHERENCE;
  }
  return averageRuns(facts.weeks, 4) >= GOAL_DEFAULT_RUNS_PER_WEEK;
}

/** Weekly target met in enough recent weeks. */
function weeklyMeasure(
  facts: GoalFacts,
  pick: (week: GoalWeekFacts) => number,
  target: number,
  weeksRequired = GOAL_HABIT_WEEKS_REQUIRED,
  window = 4,
): Measure {
  const recent = facts.weeks.slice(0, window);
  const met = recent.filter((week) => pick(week) >= target).length;
  const lastTwo = facts.weeks.slice(0, 2);
  const current = lastTwo.length ? lastTwo.reduce((sum, week) => sum + pick(week), 0) / lastTwo.length : 0;
  return {
    achieved: met >= weeksRequired,
    progressPct: pct((met / weeksRequired) * 100),
    current: Math.round(current * 10) / 10,
    target,
    onTrack: current >= target * 0.5,
  };
}

function continuousMeasure(facts: GoalFacts): Measure | null {
  const minutes = num(facts.target.continuousDurationMinutes);
  const km = num(facts.target.continuousDistanceKm);
  if (minutes !== null) {
    return {
      achieved: facts.longestRun.minutes >= minutes,
      progressPct: pct((facts.longestRun.minutes / minutes) * 100),
      current: Math.round(facts.longestRun.minutes),
      target: minutes,
      onTrack: facts.longestRecentRun.minutes >= minutes * 0.5,
    };
  }
  if (km !== null) {
    return {
      achieved: facts.longestRun.km >= km,
      progressPct: pct((facts.longestRun.km / km) * 100),
      current: Math.round(facts.longestRun.km * 10) / 10,
      target: km,
      onTrack: facts.longestRecentRun.km >= km * 0.5,
    };
  }
  return null;
}

/** Faster threshold pace or higher fitness since the goal was set. */
function improvementMeasure(facts: GoalFacts, preferFitness = false): Measure {
  const pace = facts.thresholdPace;
  const fitness = facts.fitness;
  const paceGain = pace.start && pace.latest ? ((pace.start - pace.latest) / pace.start) * 100 : null;
  const fitnessGain = fitness.start && fitness.latest ? ((fitness.latest - fitness.start) / fitness.start) * 100 : null;
  const gain = preferFitness ? (fitnessGain ?? paceGain) : (paceGain ?? fitnessGain);
  if (gain === null) {
    return { achieved: false, progressPct: null, current: null, target: GOAL_IMPROVEMENT_PCT, onTrack: null };
  }
  return {
    achieved: gain >= GOAL_IMPROVEMENT_PCT,
    progressPct: pct((gain / GOAL_IMPROVEMENT_PCT) * 100),
    current: Math.round(gain * 10) / 10,
    target: GOAL_IMPROVEMENT_PCT,
    onTrack: gain > 0,
  };
}

function paceMeasure(facts: GoalFacts, targetPace: number): Measure {
  const best = facts.bestPaceSecPerKm;
  const start = num(facts.current.paceSecondsPerKm) ?? facts.thresholdPace.start;
  if (best === null) {
    return { achieved: false, progressPct: null, current: null, target: targetPace, onTrack: null };
  }
  const progress =
    start && start > targetPace ? ((start - best) / (start - targetPace)) * 100 : best <= targetPace ? 100 : 0;
  return {
    achieved: best <= targetPace,
    progressPct: pct(progress),
    current: Math.round(best),
    target: targetPace,
    onTrack: start ? best < start : null,
  };
}

function raceMeasure(facts: GoalFacts): Measure {
  const target = facts.targetTimeSeconds;
  if (facts.race) {
    const achieved = target === null || facts.race.timeSeconds <= target;
    return {
      achieved,
      failedAttempt: !achieved,
      progressPct: target ? pct((target / facts.race.timeSeconds) * 100) : 100,
      current: facts.race.timeSeconds,
      target,
      onTrack: null,
    };
  }
  return {
    achieved: false,
    progressPct: facts.plan ? pct(facts.plan.elapsedShare * 100) : null,
    current: null,
    target,
    onTrack: null,
  };
}

function measure(type: AthleteGoalType | string, category: AthleteGoalCategory, facts: GoalFacts): Measure {
  const target = facts.target;
  switch (category) {
    case 'race_event':
      return raceMeasure(facts);

    case 'performance': {
      const pace = num(target.paceSecondsPerKm);
      if (pace !== null && (type === 'improve_pace' || type === 'improve_speed')) {
        return paceMeasure(facts, pace);
      }
      if (type === 'build_endurance' || type === 'improve_hills') {
        const continuous = continuousMeasure(facts);
        if (continuous) return continuous;
      }
      return improvementMeasure(facts, type === 'improve_aerobic_fitness');
    }

    case 'training_habit': {
      const runs = num(target.runsPerWeek);
      if (runs !== null) return weeklyMeasure(facts, (week) => week.runs, runs);
      const weeklyKm = num(target.weeklyDistanceKm);
      if (weeklyKm !== null) return weeklyMeasure(facts, (week) => week.km, weeklyKm);
      const weeklyMinutes = num(target.weeklyDurationMinutes);
      if (weeklyMinutes !== null) return weeklyMeasure(facts, (week) => week.minutes, weeklyMinutes);
      const continuous = continuousMeasure(facts);
      if (continuous) return continuous;
      // No numeric target: the habit itself — regular runs four weeks in a row.
      return weeklyMeasure(facts, (week) => week.runs, GOAL_DEFAULT_RUNS_PER_WEEK, 4);
    }

    case 'fitness_lifestyle': {
      if (type === 'lose_weight') {
        const goalWeight = num(target.weightKg);
        const weight = facts.weightKg;
        if (goalWeight === null || weight === null) {
          return { achieved: false, progressPct: null, current: weight, target: goalWeight, onTrack: null };
        }
        const start = num(facts.current.weightKg);
        const progress =
          start && start > goalWeight
            ? ((start - weight) / (start - goalWeight)) * 100
            : weight <= goalWeight
              ? 100
              : 0;
        return {
          achieved: weight <= goalWeight,
          progressPct: pct(progress),
          current: weight,
          target: goalWeight,
          onTrack: null,
        };
      }
      const runs = num(target.runsPerWeek);
      const weeklyKm = num(target.weeklyDistanceKm);
      const weeklyMinutes = num(target.weeklyDurationMinutes);
      if (weeklyKm !== null) {
        return weeklyMeasure(facts, (week) => week.km, weeklyKm, GOAL_MAINTAIN_WEEKS, GOAL_MAINTAIN_WEEKS);
      }
      if (weeklyMinutes !== null) {
        return weeklyMeasure(facts, (week) => week.minutes, weeklyMinutes, GOAL_MAINTAIN_WEEKS, GOAL_MAINTAIN_WEEKS);
      }
      return weeklyMeasure(
        facts,
        (week) => week.runs,
        runs ?? GOAL_DEFAULT_RUNS_PER_WEEK,
        GOAL_MAINTAIN_WEEKS,
        GOAL_MAINTAIN_WEEKS,
      );
    }

    case 'challenge': {
      const goalValue = num(target.challengeTargetValue);
      if (goalValue === null || !facts.challenge) {
        return { achieved: false, progressPct: null, current: null, target: goalValue, onTrack: null };
      }
      const progress = (facts.challenge.value / goalValue) * 100;
      const elapsed = facts.challenge.elapsedShare;
      return {
        achieved: facts.challenge.value >= goalValue,
        progressPct: pct(progress),
        current: Math.round(facts.challenge.value * 10) / 10,
        target: goalValue,
        onTrack: elapsed === null ? null : progress >= elapsed * 100 - 10,
      };
    }

    default:
      return {
        achieved: facts.plan?.status === 'completed',
        progressPct: facts.plan ? pct(facts.plan.elapsedShare * 100) : null,
        current: null,
        target: null,
        onTrack: null,
      };
  }
}

function isAbandoned(facts: GoalFacts): boolean {
  if (facts.goalStatus === 'cancelled') return true;
  return (
    facts.plan?.status === 'cancelled' && (facts.plan.cancelReason === 'user' || facts.plan.cancelReason === 'admin')
  );
}

function isExpired(facts: GoalFacts, category: AthleteGoalCategory): boolean {
  if (facts.goalStatus === 'completed') return true;
  if (!facts.targetDate) return false;
  const grace = category === 'race_event' ? GOAL_RACE_GRACE_DAYS : 0;
  return facts.today > addDays(facts.targetDate, grace);
}

export function evaluateGoalProgress(facts: GoalFacts): GoalProgress {
  const category = GOAL_TYPE_CATEGORY[facts.goalType as AthleteGoalType] ?? 'flexible';
  const result = measure(facts.goalType, category, facts);
  const base = { category, progressPct: result.progressPct, current: result.current, target: result.target };

  if (result.achieved) return { ...base, status: 'achieved', progressPct: 100 };
  if (isAbandoned(facts)) return { ...base, status: 'abandoned' };
  if (result.failedAttempt || isExpired(facts, category)) return { ...base, status: 'missed' };
  if (!facts.hasWorkouts && !facts.plan) return { ...base, status: 'no_data' };

  const onTrack = result.onTrack ?? fallbackOnTrack(facts);
  return { ...base, status: onTrack ? 'on_track' : 'at_risk' };
}
