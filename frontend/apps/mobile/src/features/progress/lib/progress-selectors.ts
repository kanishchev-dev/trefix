import {
  type ProgressMetric,
  type ProgressPeriod,
  type ProgressPlanExecution,
  type ProgressSnapshot,
  type ProgressTotals,
  type ProgressWorkout,
} from "../data/progress-model";

/** Pure aggregations over a progress snapshot: no React, no formatting. */

type YMD = { year: number; month: number; day: number };

export function parseYmd(iso: string): YMD {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year ?? 1970, month: (month ?? 1) - 1, day: day ?? 1 };
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday of the week that contains `iso`. */
export function weekStartOf(iso: string): string {
  const { year, month, day } = parseYmd(iso);
  const date = new Date(year, month, day);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return toIso(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(iso: string, days: number): string {
  const { year, month, day } = parseYmd(iso);
  const date = new Date(year, month, day + days);
  return toIso(date.getFullYear(), date.getMonth(), date.getDate());
}

const isDone = (workout: ProgressWorkout) => workout.status !== "missed";

function doneInPeriod(
  snapshot: ProgressSnapshot,
  period: "week" | "month",
): ProgressWorkout[] {
  const from =
    period === "week"
      ? weekStartOf(snapshot.asOf)
      : snapshot.asOf.slice(0, 8) + "01";
  return snapshot.workouts.filter(
    (workout) =>
      isDone(workout) && workout.date >= from && workout.date <= snapshot.asOf,
  );
}

/** Sum of elevations; null when none of the parts carries elevation data. */
function sumElevation(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
}

function totalsOfWorkouts(workouts: ProgressWorkout[]): ProgressTotals {
  return {
    distanceKm: workouts.reduce((a, w) => a + w.distanceKm, 0),
    durationMin: workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0),
    elevationM: sumElevation(workouts.map((w) => w.elevationM)),
    count: workouts.length,
  };
}

function addTotals(parts: ProgressTotals[]): ProgressTotals {
  return {
    distanceKm: parts.reduce((a, p) => a + p.distanceKm, 0),
    durationMin: parts.reduce((a, p) => a + p.durationMin, 0),
    elevationM: sumElevation(parts.map((p) => p.elevationM)),
    count: parts.reduce((a, p) => a + p.count, 0),
  };
}

export function totalsFor(
  snapshot: ProgressSnapshot,
  period: ProgressPeriod,
): ProgressTotals {
  if (period === "week" || period === "month") {
    return totalsOfWorkouts(doneInPeriod(snapshot, period));
  }
  const thisMonth = totalsOfWorkouts(doneInPeriod(snapshot, "month"));
  const thisYear = addTotals([...snapshot.months, thisMonth]);
  if (period === "year") return thisYear;
  return addTotals([...snapshot.years, thisYear]);
}

export function metricValue(
  totals: ProgressTotals,
  metric: ProgressMetric,
): number | null {
  if (metric === "distance") return totals.distanceKm;
  if (metric === "time") return totals.durationMin;
  return totals.elevationM;
}

/**
 * `value` — a measured value (may be 0 for a day without workouts),
 * `future` — the bucket has not happened yet, `noData` — no measurements.
 */
export type ProgressBucket = {
  kind: "day" | "month" | "year";
  /** ISO day, "YYYY-MM" or "YYYY". */
  key: string;
  value: number | null;
  state: "value" | "future" | "noData";
};

export function bucketsFor(
  snapshot: ProgressSnapshot,
  period: ProgressPeriod,
  metric: ProgressMetric,
): ProgressBucket[] {
  const asOf = snapshot.asOf;
  const pick = (totals: ProgressTotals) => metricValue(totals, metric);
  const bucket = (
    kind: ProgressBucket["kind"],
    key: string,
    totals: ProgressTotals | null,
  ): ProgressBucket => {
    if (!totals) return { kind, key, value: null, state: "future" };
    const value = pick(totals);
    return value === null
      ? { kind, key, value: null, state: "noData" }
      : { kind, key, value, state: "value" };
  };
  const dayTotals = (iso: string) =>
    totalsOfWorkouts(
      snapshot.workouts.filter((w) => isDone(w) && w.date === iso),
    );

  if (period === "week") {
    const start = weekStartOf(asOf);
    return Array.from({ length: 7 }, (_, index) => {
      const iso = addDays(start, index);
      return bucket("day", iso, iso > asOf ? null : dayTotals(iso));
    });
  }
  const { year, month } = parseYmd(asOf);
  if (period === "month") {
    return Array.from({ length: daysInMonth(year, month) }, (_, index) => {
      const iso = toIso(year, month, index + 1);
      return bucket("day", iso, iso > asOf ? null : dayTotals(iso));
    });
  }
  if (period === "year") {
    const current = totalsOfWorkouts(doneInPeriod(snapshot, "month"));
    return Array.from({ length: 12 }, (_, index) => {
      const key = `${year}-${String(index + 1).padStart(2, "0")}`;
      if (index > month) return bucket("month", key, null);
      if (index === month) return bucket("month", key, current);
      const stored = snapshot.months.find((m) => m.month === index);
      return bucket(
        "month",
        key,
        stored ?? { distanceKm: 0, durationMin: 0, elevationM: 0, count: 0 },
      );
    });
  }
  return [
    ...snapshot.years.map((y) => bucket("year", String(y.year), y)),
    bucket("year", String(year), totalsFor(snapshot, "year")),
  ];
}

export type ProgressComparisonResult = {
  scope: "week" | "month" | "year";
  diff: number;
};

/** Difference with the same stretch of the previous period; null when it is not comparable. */
export function comparisonFor(
  snapshot: ProgressSnapshot,
  period: ProgressPeriod,
  metric: ProgressMetric,
): ProgressComparisonResult | null {
  if (period === "all") return null;
  const current = metricValue(totalsFor(snapshot, period), metric);
  const previous = metricValue(snapshot.comparison[period].totals, metric);
  if (current === null || previous === null) return null;
  if (snapshot.comparison[period].totals.count === 0) return null;
  return { scope: period, diff: current - previous };
}

export function avgPace(totals: ProgressTotals): number | null {
  return totals.distanceKm > 0
    ? (totals.durationMin * 60) / totals.distanceKm
    : null;
}

function avgHeartRate(workouts: ProgressWorkout[]): number | null {
  const withHr = workouts.filter(
    (w): w is ProgressWorkout & { avgHeartRate: number; durationMin: number } =>
      w.avgHeartRate !== null && w.durationMin !== null,
  );
  const minutes = withHr.reduce((a, w) => a + w.durationMin, 0);
  if (minutes === 0) return null;
  return (
    withHr.reduce((a, w) => a + w.avgHeartRate * w.durationMin, 0) / minutes
  );
}

export type ProgressHighlightMain =
  | { kind: "volume"; from: number | null; to: number }
  | { kind: "pace"; from: number; to: number };

export type ProgressHighlightItem =
  | { kind: "longest"; km: number; previousKm: number | null }
  | { kind: "heartRate"; value: number; previous: number | null }
  | { kind: "record"; distanceKm: number; seconds: number; date: string }
  | { kind: "records"; count: number };

export type ProgressHighlights = {
  main: ProgressHighlightMain;
  items: ProgressHighlightItem[];
};

/** Two or three computed facts for the period; heart rate only when it was measured. */
export function highlightsFor(
  snapshot: ProgressSnapshot,
  period: ProgressPeriod,
): ProgressHighlights | null {
  const totals = totalsFor(snapshot, period);
  if (totals.count === 0) return null;
  const items: ProgressHighlightItem[] = [];

  if (period === "week" || period === "month") {
    const workouts = doneInPeriod(snapshot, period);
    const compare = snapshot.comparison[period];
    const longest = Math.max(...workouts.map((w) => w.distanceKm));
    items.push({
      kind: "longest",
      km: longest,
      previousKm: compare.longestKm || null,
    });
    const hr = avgHeartRate(workouts);
    if (hr !== null)
      items.push({
        kind: "heartRate",
        value: hr,
        previous: compare.avgHeartRate,
      });
    const record = workouts.find((w) => w.recordDistanceKm);
    if (record && items.length < 2 && record.durationMin !== null) {
      items.push({
        kind: "record",
        distanceKm: record.recordDistanceKm ?? record.distanceKm,
        seconds: Math.round(record.durationMin * 60),
        date: record.date,
      });
    }
    const pace = avgPace(totals);
    const main: ProgressHighlightMain =
      period === "month" && pace !== null && compare.totals.count > 0
        ? { kind: "pace", from: compare.avgPaceSecPerKm, to: pace }
        : {
            kind: "volume",
            from: compare.totals.count > 0 ? compare.totals.distanceKm : null,
            to: totals.distanceKm,
          };
    return { main, items: items.slice(0, 2) };
  }

  if (snapshot.longestRun) {
    items.push({
      kind: "longest",
      km: snapshot.longestRun.distanceKm,
      previousKm: snapshot.longestRun.previousKm,
    });
  }
  if (snapshot.recordsThisYear > 0)
    items.push({ kind: "records", count: snapshot.recordsThisYear });
  const from =
    period === "year" && snapshot.comparison.year.totals.count > 0
      ? snapshot.comparison.year.totals.distanceKm
      : null;
  return {
    main: { kind: "volume", from, to: totals.distanceKm },
    items: items.slice(0, 2),
  };
}

export type ProgressPlanExecutionView = ProgressPlanExecution & {
  scope: "week" | "month" | "sinceStart";
  /** Null when nothing was due yet — never shown as 0% or 100%. */
  percent: number | null;
};

export function planExecutionFor(
  snapshot: ProgressSnapshot,
  period: ProgressPeriod,
): ProgressPlanExecutionView | null {
  if (!snapshot.plan) return null;
  const scope =
    period === "week" ? "week" : period === "month" ? "month" : "sinceStart";
  const execution = snapshot.plan.execution[scope];
  return {
    ...execution,
    scope,
    percent:
      execution.due > 0
        ? Math.round((execution.done / execution.due) * 100)
        : null,
  };
}

export function workoutsFor(
  snapshot: ProgressSnapshot,
  period: ProgressPeriod,
  limit = 5,
): ProgressWorkout[] {
  const from = period === "week" ? weekStartOf(snapshot.asOf) : "";
  return snapshot.workouts.filter((w) => w.date >= from).slice(0, limit);
}

/** Which tabs the section shows: tabs only when both sides have something to show. */
export function sectionLayoutFor(snapshot: ProgressSnapshot): {
  empty: boolean;
  showTabs: boolean;
} {
  // Months of the current year are always listed (with zeros), so the first
  // workout date is what tells an empty history apart.
  const empty =
    snapshot.firstWorkoutDate === null &&
    snapshot.workouts.every((workout) => workout.status === "missed");
  return { empty, showTabs: !empty && snapshot.analytics.available };
}
