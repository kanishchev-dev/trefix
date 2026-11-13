import { type WorkoutType } from '../training.constants';

/**
 * Progress summary: facts of the athlete's history for the Progress screen.
 * Every date is a local calendar day (YYYY-MM-DD) in the athlete's timezone.
 */

/** Workout types shown in the summary; rest days are never workouts here. */
export type SummaryWorkoutType = Exclude<WorkoutType, 'rest'>;

/** `plan` — done within a plan, `free` — done outside a plan, `missed` — a past plan workout not done. */
export type SummaryWorkoutStatus = 'plan' | 'free' | 'missed';

export interface SummaryWorkoutView {
  /** Null for a missed workout that has no details worth opening. */
  id: string | null;
  date: string;
  type: SummaryWorkoutType;
  status: SummaryWorkoutStatus;
  /** Actual distance, or the planned one for a missed workout. */
  distanceKm: number;
  durationMin: number | null;
  avgHeartRate: number | null;
  elevationM: number | null;
  /** Record distance (km) this workout currently holds the best time on. */
  recordDistanceKm: number | null;
}

export interface SummaryTotalsView {
  distanceKm: number;
  durationMin: number;
  /** Null when none of the workouts carries elevation. */
  elevationM: number | null;
  count: number;
}

export interface SummaryMonthView extends SummaryTotalsView {
  year: number;
  /** 0–11. */
  month: number;
}

export interface SummaryYearView extends SummaryTotalsView {
  year: number;
}

export interface SummaryComparisonView {
  totals: SummaryTotalsView;
  longestKm: number;
  avgHeartRate: number | null;
  avgPaceSecPerKm: number;
}

export interface SummaryGoalView {
  distanceKm: number;
  targetSec: number;
  raceDate: string;
  best: { seconds: number; date: string } | null;
}

export interface SummaryPlanExecutionView {
  done: number;
  due: number;
  upcoming: number;
  plannedKm: number;
  actualKm: number;
  offPlanKm: number;
}

export interface SummaryPlanView {
  startDate: string;
  currentWeek: number;
  totalWeeks: number;
  execution: {
    week: SummaryPlanExecutionView;
    month: SummaryPlanExecutionView;
    sinceStart: SummaryPlanExecutionView;
  };
}

export type SummaryPaceType = 'easy' | 'tempo' | 'interval';
export type SummaryRegularityDay = 'run' | 'rest' | 'missed' | 'future';
export type SummaryInsightCode = 'easy_pace_faster' | 'volume_steady';

export interface SummaryPlanKeyWorkoutView {
  type: SummaryWorkoutType;
  date: string;
  planned: { kind: 'distance'; km: number } | { kind: 'pace'; fromSec: number; toSec: number };
  actual: { kind: 'distance'; km: number } | { kind: 'pace'; sec: number } | null;
}

export interface SummaryAnalyticsView {
  available: boolean;
  form: Record<'5' | '10', Array<{ date: string; seconds: number }>>;
  pace: Record<SummaryPaceType, Array<{ month: number; secPerKm: number }>>;
  heartRateZones: number[] | null;
  avgHeartRate: number | null;
  weeklyKm: Array<{ weekStart: string; km: number; partial: boolean }>;
  regularity: Array<{ weekStart: string; days: SummaryRegularityDay[] }>;
  planKeyWorkouts: SummaryPlanKeyWorkoutView[];
  insights: Array<{ code: SummaryInsightCode; params: Record<string, number>; usesHeartRate: boolean }>;
}

export interface ProgressSummaryView {
  asOf: string;
  workouts: SummaryWorkoutView[];
  months: SummaryMonthView[];
  years: SummaryYearView[];
  firstWorkoutDate: string | null;
  comparison: { week: SummaryComparisonView; month: SummaryComparisonView; year: SummaryComparisonView };
  longestRun: { distanceKm: number; date: string; previousKm: number | null } | null;
  recordsThisYear: number;
  goal: SummaryGoalView | null;
  plan: SummaryPlanView | null;
  analytics: SummaryAnalyticsView;
}
