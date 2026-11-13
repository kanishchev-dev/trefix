import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';

import { AthleteGoal } from '../entities/athlete-goal.entity';
import { type AthleteGoalType, GOAL_TYPE_CATEGORY } from '../goal-taxonomy';
import {
  evaluateGoalProgress,
  GOAL_MIN_PACE_RUN_KM,
  GOAL_RACE_DISTANCE_TOLERANCE,
  GOAL_RACE_GRACE_DAYS,
  type GoalFacts,
  type GoalPlanFacts,
  type GoalProgress,
  type GoalWeekFacts,
} from './goal-progress';

/** One goal judged on a given day. */
export interface GoalEvaluation {
  goalId: string;
  athleteId: string;
  goalType: string;
  targetDate: string | null;
  progress: GoalProgress;
}

/** Finished goals keep being judged this long so their final status is recorded. */
const FINISHED_GOALS_WINDOW_DAYS = 30;
/** Workouts older than this never matter for a goal's progress. */
const HISTORY_DAYS = 400;
const WEEKS = 8;
const DAY_MS = 86_400_000;

/** Legacy `race_distance` keys of race goals, in metres. */
const LEGACY_RACE_DISTANCE_M: Record<string, number> = {
  '5k': 5000,
  '10k': 10_000,
  half_marathon: 21_097.5,
  marathon: 42_195,
};

interface GoalRow {
  id: string;
  athlete_id: string;
  type: string;
  status: string;
  payload: { current?: Record<string, unknown>; target?: Record<string, unknown> } | null;
  race_distance: string;
  target_time_seconds: number | null;
  target_date: string | null;
  created_at: Date;
}

interface PlanRow {
  id: string;
  goal_id: string;
  status: string;
  cancel_reason: string | null;
  start_date: string | null;
  end_date: string | null;
  completed: string;
  skipped: string;
}

interface WorkoutRow {
  athlete_id: string;
  plan_id: string | null;
  type: string;
  completed_at: Date;
  km: number | null;
  minutes: number | null;
}

interface ResultRow {
  athlete_id: string;
  distance_m: number;
  time_seconds: number;
  date: string;
}

interface StateRow {
  athlete_id: string;
  day: string;
  threshold: number | null;
  fitness: number | null;
}

interface AthleteRow {
  id: string;
  weight_kg: number | null;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  return dayKey(new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function num(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(key(row));
    if (list) list.push(row);
    else map.set(key(row), [row]);
  }
  return map;
}

/** Start and end of a challenge period that contains the day the goal was set. */
function challengeWindow(
  period: unknown,
  created: string,
  targetDate: string | null,
): { start: string; end: string | null } {
  const date = new Date(`${created}T00:00:00Z`);
  switch (period) {
    case 'this_week': {
      const start = addDays(created, -((date.getUTCDay() + 6) % 7));
      return { start, end: addDays(start, 6) };
    }
    case 'this_month': {
      const start = `${created.slice(0, 7)}-01`;
      const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
      return { start, end: addDays(dayKey(next), -1) };
    }
    case 'this_year':
      return { start: `${created.slice(0, 4)}-01-01`, end: `${created.slice(0, 4)}-12-31` };
    default:
      return { start: created, end: targetDate };
  }
}

/**
 * Loads what goal progress needs for a page of athletes and judges each of
 * their current (and recently finished) goals. Read-only.
 */
@Injectable()
export class GoalProgressService {
  constructor(@InjectModel(AthleteGoal) private readonly goalModel: typeof AthleteGoal) {}

  /** Athletes that have goals worth judging, ordered by id for paging. */
  async athletesWithGoals(today: string, afterAthleteId: string | null, limit: number): Promise<string[]> {
    const rows = await this.goalModel.sequelize!.query<{ athlete_id: string }>(
      `SELECT DISTINCT g.athlete_id
         FROM athlete_goals g
        WHERE g.deleted_at IS NULL
          AND (g.status IN ('active', 'paused') OR g.updated_at >= :finishedSince::date)
          AND (:after::uuid IS NULL OR g.athlete_id > :after::uuid)
        ORDER BY g.athlete_id
        LIMIT :limit`,
      {
        replacements: {
          finishedSince: addDays(today, -FINISHED_GOALS_WINDOW_DAYS),
          after: afterAthleteId,
          limit,
        },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((row) => row.athlete_id);
  }

  async evaluateForAthletes(athleteIds: string[], today: string): Promise<GoalEvaluation[]> {
    if (athleteIds.length === 0) return [];
    const sequelize = this.goalModel.sequelize!;
    const query = <T extends object>(sql: string, replacements: Record<string, unknown>): Promise<T[]> =>
      sequelize.query<T>(sql, { replacements: { ids: athleteIds, ...replacements }, type: QueryTypes.SELECT });
    const historySince = addDays(today, -HISTORY_DAYS);

    const goals = await query<GoalRow>(
      `SELECT id, athlete_id, type, status, payload, race_distance, target_time_seconds, target_date, created_at
         FROM athlete_goals
        WHERE deleted_at IS NULL AND athlete_id IN (:ids)
          AND (status IN ('active', 'paused') OR updated_at >= :finishedSince::date)`,
      { finishedSince: addDays(today, -FINISHED_GOALS_WINDOW_DAYS) },
    );
    if (goals.length === 0) return [];

    const fourWeeksAgo = addDays(today, -27);
    const [plans, workouts, results, states, athletes] = await Promise.all([
      query<PlanRow>(
        `SELECT DISTINCT ON (p.goal_id)
                p.id, p.goal_id, p.status, p.cancel_reason, p.start_date, p.end_date,
                COUNT(w.id) FILTER (WHERE w.status = 'completed') AS completed,
                COUNT(w.id) FILTER (WHERE w.status = 'skipped') AS skipped
           FROM training_plans p
           LEFT JOIN workouts w
             ON w.plan_id = p.id AND w.deleted_at IS NULL AND w.type <> 'rest'
            AND w.scheduled_at >= :fourWeeksAgo::date AND w.scheduled_at < (:today::date + 1)
          WHERE p.deleted_at IS NULL AND p.athlete_id IN (:ids) AND p.goal_id IS NOT NULL
            AND p.status <> 'draft'
          GROUP BY p.id
          ORDER BY p.goal_id, p.created_at DESC`,
        { fourWeeksAgo, today },
      ),
      query<WorkoutRow>(
        `SELECT athlete_id, plan_id, type, completed_at,
                COALESCE((actual->>'actualDistanceKm')::numeric, distance_km)::float AS km,
                COALESCE((actual->>'actualDurationMinutes')::numeric, duration_minutes)::float AS minutes
           FROM workouts
          WHERE deleted_at IS NULL AND status = 'completed' AND type <> 'rest'
            AND athlete_id IN (:ids) AND completed_at >= :historySince::date`,
        { historySince },
      ),
      query<ResultRow>(
        `SELECT athlete_id, distance_m, time_seconds, date::text AS date
           FROM race_results
          WHERE deleted_at IS NULL AND kind = 'race' AND athlete_id IN (:ids) AND date >= :historySince::date`,
        { historySince },
      ),
      query<StateRow>(
        `SELECT DISTINCT ON (athlete_id, created_at::date)
                athlete_id, created_at::date::text AS day,
                threshold_pace_seconds_per_km::float AS threshold, fitness::float AS fitness
           FROM athlete_states
          WHERE athlete_id IN (:ids) AND created_at >= :historySince::date
          ORDER BY athlete_id, created_at::date, created_at DESC`,
        { historySince },
      ),
      query<AthleteRow>(`SELECT id, weight_kg::float AS weight_kg FROM athletes WHERE id IN (:ids)`, {}),
    ]);

    const planByGoal = new Map(plans.map((plan) => [plan.goal_id, plan]));
    const workoutsByAthlete = groupBy(workouts, (row) => row.athlete_id);
    const resultsByAthlete = groupBy(results, (row) => row.athlete_id);
    const statesByAthlete = groupBy(states, (row) => row.athlete_id);
    const weightByAthlete = new Map(athletes.map((row) => [row.id, num(row.weight_kg)]));

    return goals.map((goal) => {
      const facts = this.factsFor(goal, today, {
        plan: planByGoal.get(goal.id) ?? null,
        workouts: workoutsByAthlete.get(goal.athlete_id) ?? [],
        results: resultsByAthlete.get(goal.athlete_id) ?? [],
        states: statesByAthlete.get(goal.athlete_id) ?? [],
        weightKg: weightByAthlete.get(goal.athlete_id) ?? null,
      });
      return {
        goalId: goal.id,
        athleteId: goal.athlete_id,
        goalType: goal.type,
        targetDate: facts.targetDate,
        progress: evaluateGoalProgress(facts),
      };
    });
  }

  private factsFor(
    goal: GoalRow,
    today: string,
    data: {
      plan: PlanRow | null;
      workouts: WorkoutRow[];
      results: ResultRow[];
      states: StateRow[];
      weightKg: number | null;
    },
  ): GoalFacts {
    const target = goal.payload?.target ?? {};
    const current = goal.payload?.current ?? {};
    const created = dayKey(new Date(goal.created_at));
    const category = GOAL_TYPE_CATEGORY[goal.type as AthleteGoalType] ?? 'flexible';
    const raceDistanceM = num(target.distanceMeters) ?? LEGACY_RACE_DISTANCE_M[goal.race_distance] ?? null;

    const runs = data.workouts
      .map((row) => ({
        ...row,
        day: dayKey(new Date(row.completed_at)),
        km: num(row.km) ?? 0,
        minutes: num(row.minutes) ?? 0,
      }))
      .filter((row) => row.day >= created && row.day <= today);

    const weeks: GoalWeekFacts[] = Array.from({ length: WEEKS }, (_, index) => {
      const to = addDays(today, -7 * index);
      const from = addDays(to, -6);
      const inWeek = runs.filter((row) => row.day >= from && row.day <= to);
      return {
        runs: inWeek.length,
        km: inWeek.reduce((sum, row) => sum + row.km, 0),
        minutes: inWeek.reduce((sum, row) => sum + row.minutes, 0),
      };
    });
    const longest = (list: typeof runs): { minutes: number; km: number } => ({
      minutes: list.reduce((max, row) => Math.max(max, row.minutes), 0),
      km: list.reduce((max, row) => Math.max(max, row.km), 0),
    });
    const recentFrom = addDays(today, -13);

    const paceMinKm = Math.max(GOAL_MIN_PACE_RUN_KM, ((num(target.distanceMeters) ?? 0) / 1000) * 0.95);
    const paces = runs
      .filter((row) => row.km >= paceMinKm && row.minutes > 0)
      .map((row) => (row.minutes * 60) / row.km)
      .filter((pace) => pace >= 150 && pace <= 900);

    const planFacts = this.planFacts(data.plan, today);
    const targetDate =
      goal.target_date ??
      (category === 'challenge' ? challengeWindow(target.challengePeriod, created, null).end : null);

    return {
      goalType: goal.type,
      goalStatus: goal.status,
      target,
      current,
      raceDistanceM,
      targetTimeSeconds: num(target.finishTimeSec) ?? goal.target_time_seconds,
      targetDate,
      today,
      weeks,
      longestRun: longest(runs),
      longestRecentRun: longest(runs.filter((row) => row.day >= recentFrom)),
      bestPaceSecPerKm: paces.length ? Math.min(...paces) : null,
      race: category === 'race_event' ? this.bestRace(goal, created, raceDistanceM, runs, data.results) : null,
      plan: planFacts,
      thresholdPace: this.series(data.states, created, (row) => row.threshold),
      fitness: this.series(data.states, created, (row) => row.fitness),
      weightKg: data.weightKg,
      challenge: category === 'challenge' ? this.challenge(target, created, goal.target_date, today, runs) : null,
      hasWorkouts: runs.length > 0,
    };
  }

  private planFacts(plan: PlanRow | null, today: string): GoalPlanFacts | null {
    if (!plan) return null;
    const completed = Number(plan.completed) || 0;
    const skipped = Number(plan.skipped) || 0;
    let elapsedShare = plan.status === 'completed' ? 1 : 0;
    if (plan.start_date && plan.end_date && plan.status !== 'completed') {
      const total = Math.max(daysBetween(plan.start_date, plan.end_date), 1);
      elapsedShare = Math.max(0, Math.min(1, daysBetween(plan.start_date, today) / total));
    }
    return {
      status: plan.status,
      cancelReason: plan.cancel_reason,
      adherence: completed + skipped > 0 ? completed / (completed + skipped) : null,
      elapsedShare,
    };
  }

  /** Fastest race on the goal distance: the plan's race workout or a logged race result. */
  private bestRace(
    goal: GoalRow,
    created: string,
    distanceM: number | null,
    runs: Array<WorkoutRow & { day: string; km: number; minutes: number }>,
    results: ResultRow[],
  ): { timeSeconds: number; date: string } | null {
    const until = goal.target_date ? addDays(goal.target_date, GOAL_RACE_GRACE_DAYS) : '9999-12-31';
    const matches = (meters: number): boolean =>
      distanceM === null || Math.abs(meters - distanceM) / distanceM <= GOAL_RACE_DISTANCE_TOLERANCE;
    const candidates = [
      ...runs
        .filter((row) => row.type === 'race' && row.minutes > 0 && row.day <= until && matches(row.km * 1000))
        .map((row) => ({ timeSeconds: Math.round(row.minutes * 60), date: row.day })),
      ...results
        .filter((row) => row.date >= created && row.date <= until && matches(row.distance_m))
        .map((row) => ({ timeSeconds: row.time_seconds, date: row.date })),
    ];
    return candidates.sort((left, right) => left.timeSeconds - right.timeSeconds)[0] ?? null;
  }

  /** Value on the day the goal was set (or the first one after) and the latest value. */
  private series(
    states: StateRow[],
    created: string,
    pick: (row: StateRow) => number | null,
  ): { start: number | null; latest: number | null } {
    const values = states
      .map((row) => ({ day: row.day, value: num(pick(row)) }))
      .filter((row): row is { day: string; value: number } => row.value !== null && row.value > 0)
      .sort((left, right) => left.day.localeCompare(right.day));
    if (values.length === 0) return { start: null, latest: null };
    const before = values.filter((row) => row.day <= created);
    const start = before.length ? before[before.length - 1] : values[0];
    return { start: start.value, latest: values[values.length - 1].value };
  }

  private challenge(
    target: Record<string, unknown>,
    created: string,
    targetDate: string | null,
    today: string,
    runs: Array<{ day: string; km: number; minutes: number }>,
  ): { value: number; elapsedShare: number | null } {
    const window = challengeWindow(target.challengePeriod, created, targetDate);
    const last = window.end && window.end < today ? window.end : today;
    const inWindow = runs.filter((row) => row.day >= window.start && row.day <= last);
    let value: number;
    switch (target.challengeMetric) {
      case 'total_distance':
        value = inWindow.reduce((sum, row) => sum + row.km, 0);
        break;
      case 'total_duration':
        value = inWindow.reduce((sum, row) => sum + row.minutes, 0);
        break;
      case 'active_days':
        value = new Set(inWindow.map((row) => row.day)).size;
        break;
      default:
        value = inWindow.length;
    }
    const elapsedShare = window.end
      ? Math.max(0, Math.min(1, (daysBetween(window.start, last) + 1) / (daysBetween(window.start, window.end) + 1)))
      : null;
    return { value, elapsedShare };
  }
}
