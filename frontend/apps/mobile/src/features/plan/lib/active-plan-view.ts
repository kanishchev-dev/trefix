import {
  type PlanAdaptation,
  type PlanDetails,
  type PlanOverview,
  type PlanPhase,
  type PlanWorkoutItem,
} from "@trefix/api-client";

import {
  addDaysIso,
  mondayBasedWeekday,
  todayIso,
  workoutLocalDate,
} from "../../plans/lib/plan-dates";
import { toPlanPhase } from "../../plans/lib/plan-texts";

/*
 * View model of the plan in progress on the Plan tab: weeks with their facts,
 * phase groups, the current week by day and the load landscape. Pure, so the
 * screen only lays it out.
 */

export type WeekProgress = "completed" | "current" | "upcoming";

export type PlanWeekStats = {
  weekNumber: number;
  phase: PlanPhase;
  status: WeekProgress;
  plannedKm: number;
  actualKm: number;
  workouts: number;
  done: number;
  missed: number;
  /** Types of the quality sessions of the week, without repeats. */
  keyTypes: string[];
};

export type PhaseGroup = {
  phase: PlanPhase;
  from: number;
  to: number;
  plannedKm: number;
  /** `done` — every week completed, `current` — the plan is inside, `upcoming` — not reached. */
  state: "done" | "current" | "upcoming";
  weeks: PlanWeekStats[];
};

export type WeekDayKind = "done" | "missed" | "planned" | "rest";

export type WeekDay = {
  date: string;
  /** Monday-based weekday of the date. */
  weekday: number;
  isToday: boolean;
  kind: WeekDayKind;
  /** Run distance for a done day, planned distance otherwise. */
  km: number;
  /** Type of the first workout of the day. */
  type: string | null;
  workoutIds: string[];
};

export type LandscapeBar = {
  weekNumber: number;
  /** Planned volume relative to the biggest week, 0..1. */
  ratio: number;
  status: WeekProgress;
};

const isActive = (workout: PlanWorkoutItem) => workout.status !== "cancelled";

export function actualDistanceKm(workout: PlanWorkoutItem): number {
  const value = Number(
    (workout.actual as Record<string, unknown> | null)?.actualDistanceKm ?? 0,
  );
  return Number.isFinite(value) ? value : 0;
}

/** Overview weeks joined with the dated workouts of the plan. */
export function planWeekStats(
  weeks: PlanOverview["weeks"],
  workouts: PlanWorkoutItem[] = [],
): PlanWeekStats[] {
  return weeks.map((week) => {
    const dated = workouts.filter(
      (workout) => workout.weekNumber === week.weekNumber && isActive(workout),
    );
    const completed = dated.filter((workout) => workout.status === "completed");
    const plannedFromWorkouts = dated.reduce(
      (sum, workout) => sum + workout.distanceKm,
      0,
    );
    return {
      weekNumber: week.weekNumber,
      phase: toPlanPhase(week.phase),
      status: week.status,
      plannedKm: week.plannedDistance ?? plannedFromWorkouts,
      actualKm: completed.reduce(
        (sum, workout) => sum + actualDistanceKm(workout),
        0,
      ),
      workouts: week.plannedWorkoutsCount ?? dated.length,
      done: completed.length,
      missed: dated.filter((workout) => workout.status === "skipped").length,
      keyTypes: [...new Set(week.keySessions.map((session) => session.type))],
    };
  });
}

/** 1..3 on the intensity meter: by the number of quality sessions in the week. */
export function weekIntensity(week: PlanWeekStats): 1 | 2 | 3 {
  if (week.keyTypes.length >= 2) return 3;
  return week.keyTypes.length === 1 ? 2 : 1;
}

/** Consecutive weeks of the same phase. */
export function phaseGroups(weeks: PlanWeekStats[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const week of weeks) {
    const last = groups[groups.length - 1];
    if (last && last.phase === week.phase) {
      last.to = week.weekNumber;
      last.plannedKm += week.plannedKm;
      last.weeks.push(week);
    } else {
      groups.push({
        phase: week.phase,
        from: week.weekNumber,
        to: week.weekNumber,
        plannedKm: week.plannedKm,
        state: "upcoming",
        weeks: [week],
      });
    }
  }
  for (const group of groups) {
    group.state = group.weeks.every((week) => week.status === "completed")
      ? "done"
      : group.weeks.some((week) => week.status !== "upcoming")
        ? "current"
        : "upcoming";
  }
  return groups;
}

/** First day of a plan week. */
export function weekStartDate(startDate: string, weekNumber: number): string {
  return addDaysIso(startDate, (weekNumber - 1) * 7);
}

/** Seven days of a plan week with their workouts. */
export function weekDays(
  weekStart: string,
  workouts: PlanWorkoutItem[],
  today: string = todayIso(),
): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDaysIso(weekStart, index);
    const items = workouts.filter(
      (workout) =>
        isActive(workout) && workoutLocalDate(workout.scheduledAt) === date,
    );
    const allDone =
      items.length > 0 && items.every((item) => item.status === "completed");
    const missed =
      items.length > 0 &&
      items.some((item) => item.status === "skipped") &&
      !items.some((item) => item.status === "planned");
    const kind: WeekDayKind =
      items.length === 0
        ? "rest"
        : allDone
          ? "done"
          : missed
            ? "missed"
            : "planned";
    return {
      date,
      weekday: mondayBasedWeekday(date),
      isToday: date === today,
      kind,
      km: items.reduce(
        (sum, item) =>
          sum +
          (item.status === "completed"
            ? actualDistanceKm(item) || item.distanceKm
            : item.distanceKm),
        0,
      ),
      type: items[0]?.type ?? null,
      workoutIds: items.map((item) => item.id),
    };
  });
}

/** Weekly planned volume as bars, the biggest week being 1. */
export function loadLandscape(weeks: PlanWeekStats[]): LandscapeBar[] {
  const max = Math.max(1, ...weeks.map((week) => week.plannedKm));
  return weeks.map((week) => ({
    weekNumber: week.weekNumber,
    ratio: week.plannedKm / max,
    status: week.status,
  }));
}

/** Workouts scheduled for a date (today by default). */
export function workoutsOn(
  workouts: PlanWorkoutItem[],
  date: string = todayIso(),
): PlanWorkoutItem[] {
  return workouts.filter(
    (workout) =>
      isActive(workout) && workoutLocalDate(workout.scheduledAt) === date,
  );
}

/** The most recent change made by the coach. */
export function latestAdaptation(
  adaptations: PlanAdaptation[],
): PlanAdaptation | null {
  return (
    [...adaptations].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0] ?? null
  );
}

const KEY_TYPES = new Set([
  "interval",
  "threshold",
  "tempo",
  "long_run",
  "race",
  "hill",
]);

/**
 * Weeks of a plan opened from the library: a draft (relative workouts, all
 * ahead) or history (dated workouts with their facts).
 */
export function detailsWeekStats(
  details: PlanDetails,
  mode: "relative" | "history",
): PlanWeekStats[] {
  return details.weeks.map((week) => {
    const dated = details.workouts.filter(
      (workout) => workout.weekNumber === week.weekNumber && isActive(workout),
    );
    const sessions: Array<{ type: string; distanceKm: number }> =
      mode === "relative" ? (week.workouts ?? []) : dated;
    const completed = dated.filter((workout) => workout.status === "completed");
    const missed = dated.filter((workout) => workout.status !== "completed");
    // A cancelled plan stops early: weeks it never reached are not "missed".
    const reached =
      mode === "history" &&
      (completed.length > 0 ||
        missed.some((workout) => workout.status === "skipped"));
    return {
      weekNumber: week.weekNumber,
      phase: toPlanPhase(week.phase),
      status: reached ? "completed" : "upcoming",
      plannedKm: sessions.reduce((sum, item) => sum + item.distanceKm, 0),
      actualKm: completed.reduce(
        (sum, workout) => sum + actualDistanceKm(workout),
        0,
      ),
      workouts: sessions.length,
      done: completed.length,
      missed: reached ? missed.length : 0,
      keyTypes: [
        ...new Set(
          sessions
            .filter((item) => KEY_TYPES.has(item.type))
            .map((item) => item.type),
        ),
      ],
    };
  });
}
