import {
  type ProgressAnalytics,
  type ProgressComparison,
  type ProgressSnapshot,
  type ProgressWorkout,
} from "../../data/progress-model";

/**
 * Test fixtures of the Progress section. Every number is fixed and the
 * variants are derived from one base, so totals, charts and comparisons never
 * contradict each other.
 */

const AS_OF = "2026-10-15";

const BASE_WORKOUTS: ProgressWorkout[] = [
  {
    id: null,
    date: "2026-10-15",
    type: "easy",
    status: "plan",
    distanceKm: 6.1,
    durationMin: 36,
    avgHeartRate: 142,
    elevationM: 40,
  },
  {
    id: null,
    date: "2026-10-14",
    type: "tempo",
    status: "plan",
    distanceKm: 9.0,
    durationMin: 47,
    avgHeartRate: 158,
    elevationM: 60,
  },
  {
    id: null,
    date: "2026-10-12",
    type: "long_run",
    status: "plan",
    distanceKm: 16.2,
    durationMin: 92,
    avgHeartRate: 148,
    elevationM: 180,
  },
  {
    id: null,
    date: "2026-10-11",
    type: "easy",
    status: "missed",
    distanceKm: 6,
    durationMin: null,
    avgHeartRate: null,
    elevationM: null,
  },
  {
    id: null,
    date: "2026-10-10",
    type: "easy",
    status: "plan",
    distanceKm: 6.1,
    durationMin: 36,
    avgHeartRate: 141,
    elevationM: 30,
  },
  {
    id: null,
    date: "2026-10-08",
    type: "interval",
    status: "plan",
    distanceKm: 8.0,
    durationMin: 44,
    avgHeartRate: 161,
    elevationM: 40,
  },
  {
    id: null,
    date: "2026-10-05",
    type: "easy",
    status: "free",
    distanceKm: 8.4,
    durationMin: 49,
    avgHeartRate: 145,
    elevationM: 70,
  },
  {
    id: null,
    date: "2026-10-03",
    type: "race",
    status: "plan",
    distanceKm: 10.0,
    durationMin: 47.25,
    avgHeartRate: 166,
    elevationM: 50,
    recordDistanceKm: 10,
  },
  {
    id: null,
    date: "2026-10-01",
    type: "easy",
    status: "plan",
    distanceKm: 7.0,
    durationMin: 41,
    avgHeartRate: 140,
    elevationM: 40,
  },
];

const MONTH_KM = [62, 58, 80, 95, 62, 74, 70, 88, 98];
const MONTH_COUNT = [9, 8, 10, 12, 9, 10, 9, 11, 12];

const comparison = (
  distanceKm: number,
  durationMin: number,
  elevationM: number,
  count: number,
  longestKm: number,
  avgHeartRate: number,
): ProgressComparison => ({
  totals: { distanceKm, durationMin, elevationM, count },
  longestKm,
  avgHeartRate,
  avgPaceSecPerKm: (durationMin * 60) / distanceKm,
});

const BASE_ANALYTICS: ProgressAnalytics = {
  available: true,
  form: {
    "10": [
      { date: "2026-03-12", seconds: 2990 },
      { date: "2026-06-14", seconds: 2907 },
      { date: "2026-10-03", seconds: 2835 },
    ],
    "5": [
      { date: "2026-04-05", seconds: 1420 },
      { date: "2026-07-19", seconds: 1385 },
      { date: "2026-09-21", seconds: 1361 },
    ],
  },
  pace: {
    easy: [
      { month: 6, secPerKm: 372 },
      { month: 7, secPerKm: 365 },
      { month: 8, secPerKm: 358 },
      { month: 9, secPerKm: 352 },
    ],
    tempo: [
      { month: 6, secPerKm: 312 },
      { month: 7, secPerKm: 306 },
      { month: 8, secPerKm: 301 },
      { month: 9, secPerKm: 296 },
    ],
    interval: [
      { month: 6, secPerKm: 274 },
      { month: 7, secPerKm: 268 },
      { month: 8, secPerKm: 261 },
      { month: 9, secPerKm: 256 },
    ],
  },
  heartRateZones: [18, 46, 20, 12, 4],
  avgHeartRate: 150,
  weeklyKm: [
    { weekStart: "2026-08-31", km: 28, partial: false },
    { weekStart: "2026-09-07", km: 32, partial: false },
    { weekStart: "2026-09-14", km: 30, partial: false },
    { weekStart: "2026-09-21", km: 36, partial: false },
    { weekStart: "2026-09-28", km: 23, partial: false },
    { weekStart: "2026-10-05", km: 22.5, partial: false },
    { weekStart: "2026-10-12", km: 31.3, partial: true },
  ],
  regularity: [
    {
      weekStart: "2026-09-21",
      days: ["run", "rest", "run", "rest", "run", "rest", "run"],
    },
    {
      weekStart: "2026-09-28",
      days: ["rest", "run", "rest", "run", "rest", "run", "rest"],
    },
    {
      weekStart: "2026-10-05",
      days: ["run", "rest", "rest", "run", "rest", "run", "missed"],
    },
    {
      weekStart: "2026-10-12",
      days: ["run", "rest", "run", "run", "future", "future", "future"],
    },
  ],
  planKeyWorkouts: [
    {
      type: "long_run",
      date: "2026-10-12",
      planned: { kind: "distance", km: 16 },
      actual: { kind: "distance", km: 16.2 },
    },
    {
      type: "tempo",
      date: "2026-10-14",
      planned: { kind: "pace", fromSec: 295, toSec: 305 },
      actual: { kind: "pace", sec: 298 },
    },
    {
      type: "interval",
      date: "2026-10-08",
      planned: { kind: "pace", fromSec: 250, toSec: 260 },
      actual: { kind: "pace", sec: 256 },
    },
    {
      type: "easy",
      date: "2026-10-11",
      planned: { kind: "distance", km: 6 },
      actual: null,
    },
  ],
  insights: [
    {
      code: "easy_pace_faster",
      params: { seconds: 20, workouts: 9 },
      usesHeartRate: true,
    },
    {
      code: "volume_steady",
      params: { min: 6, max: 10, weeks: 6 },
      usesHeartRate: false,
    },
  ],
};

const BASE: ProgressSnapshot = {
  asOf: AS_OF,
  workouts: BASE_WORKOUTS,
  months: MONTH_KM.map((km, month) => ({
    year: 2026,
    month,
    distanceKm: km,
    durationMin: km * 6.1,
    elevationM: km * 7,
    count: MONTH_COUNT[month] ?? 0,
  })),
  years: [
    {
      year: 2023,
      distanceKm: 410,
      durationMin: 410 * 6.2,
      elevationM: 410 * 7,
      count: 61,
    },
    {
      year: 2024,
      distanceKm: 720,
      durationMin: 720 * 6.2,
      elevationM: 720 * 7,
      count: 98,
    },
    {
      year: 2025,
      distanceKm: 905,
      durationMin: 905 * 6.2,
      elevationM: 905 * 7,
      count: 121,
    },
  ],
  firstWorkoutDate: "2023-03-04",
  comparison: {
    week: comparison(16.4, 93, 110, 2, 8.4, 153),
    month: comparison(52.3, 312, 410, 7, 14, 153),
    year: comparison(690, 4209, 4830, 92, 16, 152),
  },
  longestRun: { distanceKm: 21.4, date: "2026-09-20", previousKm: 16 },
  recordsThisYear: 3,
  goal: {
    distanceKm: 10,
    targetSec: 2700,
    raceDate: "2026-11-22",
    best: { seconds: 2835, date: "2026-10-03" },
  },
  plan: {
    startDate: "2026-09-01",
    currentWeek: 7,
    totalWeeks: 12,
    execution: {
      week: {
        done: 3,
        due: 3,
        upcoming: 2,
        plannedKm: 31,
        actualKm: 31.3,
        offPlanKm: 0,
      },
      month: {
        done: 7,
        due: 8,
        upcoming: 9,
        plannedKm: 68,
        actualKm: 62.4,
        offPlanKm: 8.4,
      },
      sinceStart: {
        done: 26,
        due: 29,
        upcoming: 26,
        plannedKm: 255,
        actualKm: 241,
        offPlanKm: 8.4,
      },
    },
  },
  analytics: BASE_ANALYTICS,
};

/** No plan: nothing is missed, every workout is a free one, no plan blocks. */
function withoutPlan(snapshot: ProgressSnapshot): ProgressSnapshot {
  return {
    ...snapshot,
    goal: null,
    plan: null,
    workouts: snapshot.workouts
      .filter((workout) => workout.status !== "missed")
      .map((workout) => ({ ...workout, status: "free" })),
    analytics: {
      ...snapshot.analytics,
      planKeyWorkouts: [],
      regularity: snapshot.analytics.regularity.map((week) => ({
        ...week,
        days: week.days.map((day) => (day === "missed" ? "rest" : day)),
      })),
    },
  };
}

/** Workouts recorded without heart rate and elevation: those metrics are absent, not zero. */
function withoutSensors(snapshot: ProgressSnapshot): ProgressSnapshot {
  const noElevation = <T extends { elevationM: number | null }>(
    item: T,
  ): T => ({
    ...item,
    elevationM: null,
  });
  const strip = (value: ProgressComparison): ProgressComparison => ({
    ...value,
    totals: { ...value.totals, elevationM: null },
    avgHeartRate: null,
  });
  return {
    ...snapshot,
    workouts: snapshot.workouts.map((workout) => ({
      ...noElevation(workout),
      avgHeartRate: null,
    })),
    months: snapshot.months.map(noElevation),
    years: snapshot.years.map(noElevation),
    comparison: {
      week: strip(snapshot.comparison.week),
      month: strip(snapshot.comparison.month),
      year: strip(snapshot.comparison.year),
    },
    analytics: {
      ...snapshot.analytics,
      heartRateZones: null,
      avgHeartRate: null,
    },
  };
}

const EMPTY_COMPARISON = comparison(0, 0, 0, 0, 0, 0);

const EMPTY: ProgressSnapshot = {
  asOf: AS_OF,
  workouts: [],
  months: [],
  years: [],
  firstWorkoutDate: null,
  comparison: {
    week: EMPTY_COMPARISON,
    month: EMPTY_COMPARISON,
    year: EMPTY_COMPARISON,
  },
  longestRun: null,
  recordsThisYear: 0,
  goal: null,
  plan: null,
  analytics: {
    ...BASE_ANALYTICS,
    available: false,
    form: { "5": [], "10": [] },
    weeklyKm: [],
    regularity: [],
    planKeyWorkouts: [],
    insights: [],
  },
};

export type ProgressFixture =
  | "empty"
  | "activityOnly"
  | "overviewOnly"
  | "activePlan"
  | "partialMetrics";

export function progressFixture(scenario: ProgressFixture): ProgressSnapshot {
  switch (scenario) {
    case "empty":
      return EMPTY;
    case "activityOnly":
      return withoutPlan(BASE);
    case "overviewOnly": {
      const snapshot = withoutPlan(BASE);
      return {
        ...snapshot,
        analytics: { ...snapshot.analytics, available: false },
      };
    }
    case "partialMetrics":
      return withoutSensors(withoutPlan(BASE));
    case "activePlan":
      return BASE;
  }
}
