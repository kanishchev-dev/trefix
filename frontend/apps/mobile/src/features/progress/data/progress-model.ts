/**
 * Domain model of the Progress section. The UI reads only these types; the API
 * summary is mapped into them by `progress-mapper`.
 */

export type ProgressPeriod = "week" | "month" | "year" | "all";
export type ProgressMetric = "distance" | "time" | "elevation";
export type ProgressTab = "overview" | "analytics";

/** Workout type codes of the backend (rest days are never listed); labels come from the app copy. */
export type ProgressWorkoutType =
  | "recovery"
  | "easy"
  | "long_run"
  | "tempo"
  | "threshold"
  | "interval"
  | "hill"
  | "race";

/**
 * `plan` — done as planned, `free` — done outside the plan,
 * `missed` — a planned workout that was not done (future ones never land here).
 */
export type ProgressWorkoutStatus = "plan" | "free" | "missed";

export type ProgressWorkout = {
  /** Null for demo workouts that have no details screen. */
  id: string | null;
  /** ISO date, local calendar day. */
  date: string;
  type: ProgressWorkoutType;
  status: ProgressWorkoutStatus;
  /** Planned distance for a missed workout. */
  distanceKm: number;
  durationMin: number | null;
  avgHeartRate: number | null;
  elevationM: number | null;
  /** Personal record set by this workout, e.g. 10 km. */
  recordDistanceKm?: number | null;
};

export type ProgressTotals = {
  distanceKm: number;
  durationMin: number;
  /** Null when the workouts carry no elevation data. */
  elevationM: number | null;
  count: number;
};

/** Aggregated history older than the detailed workout list. */
export type ProgressMonth = {
  year: number;
  /** 0–11. */
  month: number;
  distanceKm: number;
  durationMin: number;
  elevationM: number | null;
  count: number;
};

export type ProgressYear = {
  year: number;
  distanceKm: number;
  durationMin: number;
  elevationM: number | null;
  count: number;
};

/** The same stretch of the previous period, for an honest comparison of an unfinished one. */
export type ProgressComparison = {
  totals: ProgressTotals;
  longestKm: number;
  avgHeartRate: number | null;
  avgPaceSecPerKm: number;
};

export type ProgressGoal = {
  distanceKm: number;
  targetSec: number;
  raceDate: string;
  /** Best confirmed result on the goal distance (race or control workout). */
  best: { seconds: number; date: string } | null;
};

export type ProgressPlanExecution = {
  done: number;
  /** Planned workouts whose date has passed. */
  due: number;
  upcoming: number;
  plannedKm: number;
  actualKm: number;
  offPlanKm: number;
};

export type ProgressPlan = {
  startDate: string;
  currentWeek: number;
  totalWeeks: number;
  /** Execution by scope: this week, this month, since the plan start. */
  execution: {
    week: ProgressPlanExecution;
    month: ProgressPlanExecution;
    sinceStart: ProgressPlanExecution;
  };
};

export type ProgressFormEffort = { date: string; seconds: number };

export type ProgressPaceType = "easy" | "tempo" | "interval";

export type ProgressRegularityDay = "run" | "rest" | "missed" | "future";

export type ProgressInsight = {
  code: "easy_pace_faster" | "volume_steady";
  params: Record<string, number>;
  /** Whether the insight relies on heart rate data. */
  usesHeartRate: boolean;
};

/** A distance target or a pace range (sec/km); `actual` is null for a missed workout. */
export type ProgressPlanKeyWorkout = {
  type: ProgressWorkoutType;
  date: string;
  planned:
    | { kind: "distance"; km: number }
    | { kind: "pace"; fromSec: number; toSec: number };
  actual:
    | { kind: "distance"; km: number }
    | { kind: "pace"; sec: number }
    | null;
};

export type ProgressAnalytics = {
  /** False until at least one block has enough data. */
  available: boolean;
  form: Record<"5" | "10", ProgressFormEffort[]>;
  /** Average pace by month (sec/km), oldest first. */
  pace: Record<ProgressPaceType, { month: number; secPerKm: number }[]>;
  /** Share of time in zones Z1–Z5, percent; null without heart rate data. */
  heartRateZones: number[] | null;
  avgHeartRate: number | null;
  /** Weekly kilometres, oldest first; the last week may be unfinished. */
  weeklyKm: { weekStart: string; km: number; partial: boolean }[];
  /** Last four weeks, Monday first. */
  regularity: { weekStart: string; days: ProgressRegularityDay[] }[];
  /** Key workouts of the plan with planned and actual values. */
  planKeyWorkouts: ProgressPlanKeyWorkout[];
  insights: ProgressInsight[];
};

export type ProgressSnapshot = {
  /** "Today" for all period maths. */
  asOf: string;
  /** Detailed workouts of the current month, newest first. */
  workouts: ProgressWorkout[];
  /** Months of the current year before the current one. */
  months: ProgressMonth[];
  /** Years before the current one. */
  years: ProgressYear[];
  firstWorkoutDate: string | null;
  comparison: {
    week: ProgressComparison;
    month: ProgressComparison;
    year: ProgressComparison;
  };
  longestRun: {
    distanceKm: number;
    date: string;
    previousKm: number | null;
  } | null;
  recordsThisYear: number;
  goal: ProgressGoal | null;
  plan: ProgressPlan | null;
  analytics: ProgressAnalytics;
};
