import { WorkoutAnalysisView, WorkoutView } from '../interfaces/training-views.interface';

export interface TrainingStateComputation {
  fitness: number;
  fatigue: number;
  form: number;
  weeklyLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  recoveryScore: number;
  thresholdPaceSecondsPerKm: number | null;
  thresholdHeartRate: number | null;
  vo2max: number | null;
  confidence: number;
  source: string;
}

export interface WorkoutBuildResult {
  type: WorkoutView['type'];
  phase: string;
  weekNumber: number;
  scheduledAt: Date;
  orderInWeek: number;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

export interface ManualPlanOptions {
  /** Desired number of training weeks chosen by the user. */
  totalWeeks?: number;
  /** Preferred weekday index (0 = Monday) for the long run. */
  preferredLongRunDay?: number;
  /** Workout types the user wants to see in the plan. */
  focus?: string[];
}

export interface PlanBuildResult {
  startDate: string;
  endDate: string;
  trainingFrequency: number;
  weeklyTargetKm: number;
  weeks: Array<Record<string, unknown>>;
  workouts: WorkoutBuildResult[];
}

export interface WorkoutAnalysisInput {
  plannedWorkout: WorkoutView;
  actualDurationMinutes: number;
  actualDistanceKm: number;
  actualAveragePaceSecondsPerKm?: number;
  actualAverageHeartRate?: number;
  rpe?: number;
}

export interface WorkoutAnalysisResult {
  analysis: WorkoutAnalysisView;
  trainingLoad: number;
  intensityFactor: number;
  fatigueImpact: WorkoutAnalysisView['fatigueImpact'];
}

export interface AdaptationResult {
  action: string;
  reason: string;
  confidence: number;
  changes: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Plan lifecycle transforms
// ---------------------------------------------------------------------------

/** Athlete metrics used by rebuild flows. */
export interface AthleteMetrics {
  capturedAt?: string;
  thresholdPaceSecondsPerKm?: number | null;
  thresholdHeartRate?: number | null;
  maxHeartRate?: number | null;
  restingHeartRate?: number | null;
  weeklyMileageKm?: number | null;
  longestRunKm?: number | null;
  recentResult?: { distance: string; timeSeconds: number; date: string } | null;
  source?: string;
}

/** Workout of a relative (undated) plan week; `dayOfWeek`: 0 = Monday. */
export interface RelativeWorkout {
  key: string;
  dayOfWeek: number;
  orderInWeek: number;
  type: WorkoutView['type'];
  phase: string;
  title?: string;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

/** Relative plan structure stored on drafts. */
export interface RelativeWeek {
  weekNumber: number;
  phase: string;
  title?: string;
  intent?: string;
  weeklyLoadTarget?: number;
  workouts: RelativeWorkout[];
}

/** Concrete dated workout produced by materializeWeeks. */
export interface MaterializedWorkout {
  key: string;
  weekNumber: number;
  scheduledAt: Date;
  orderInWeek: number;
  type: WorkoutView['type'];
  phase: string;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

export interface MaterializeResult {
  startDate: string;
  endDate: string;
  totalWeeks: number;
  /** Dated week records ready for `plan.weeks` (workoutIds hold keys until persist). */
  weeks: Array<Record<string, unknown>>;
  workouts: MaterializedWorkout[];
  dropped: Array<{ key: string; reason: string }>;
}

export interface RemapResult {
  weeks: RelativeWeek[];
  removed: Array<{ key: string; reason: string }>;
}

export interface PlanDiffAdjustment {
  code: string;
  params?: Record<string, unknown>;
}

export interface PlanDiffWorkout {
  key: string;
  change: 'added' | 'removed' | 'modified';
  fields?: Record<string, [unknown, unknown]>;
  reason?: string;
}

export interface PlanDiffWeek {
  weekNumber: number;
  change: 'added' | 'removed' | 'modified';
  workouts: PlanDiffWorkout[];
}

export interface PlanDiff {
  summary: {
    weeklyVolumeKm: { before: number[]; after: number[] };
    peakWeekKm: { before: number; after: number };
    longestRunKm: { before: number | null; after: number | null };
    thresholdPace: { before: number | null; after: number | null };
    totalWeeks: { before: number; after: number };
    adjustments: PlanDiffAdjustment[];
  };
  weeks: PlanDiffWeek[];
}

/** Minimal workout shape extractFinalVersion consumes. */
export interface ExtractableWorkout {
  /** Persisted id; used as the relative key when projecting an active plan. */
  id?: string;
  weekNumber: number;
  orderInWeek: number;
  scheduledAt: Date;
  type: string;
  phase: string;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

/** Error name used when a target-date resize is impossible. */
/** The requested plan length cannot hold the phases the goal needs. */
export class PlanResizeNotPossibleError extends Error {
  constructor() {
    super('PLAN_RESIZE_NOT_POSSIBLE');
    this.name = 'PlanResizeNotPossibleError';
  }
}

/** Options of materializeWeeks. */
export interface MaterializeOptions {
  /**
   * Moves first-week sessions that fall before the start weekday. Disabled when
   * the weeks continue an already running plan, where every weekday is valid.
   */
  relocateFirstWeek?: boolean;
}
