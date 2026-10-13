import type {
  AdaptationAction,
  AdaptationEventStatus,
  AthleteFieldSources,
  AthleteGoalDistance,
  AthleteGoalStatus,
  AthleteSexValue,
  HrZonesMethod,
  TimeOfDay,
  TrainingPhase,
  TrainingPlanStatus,
  WorkoutStatus,
  WorkoutType,
} from '../training.constants';

export interface AthleteView {
  id: string;
  userId: string;
  age: number | null;
  sex: AthleteSexValue | null;
  heightCm: number | null;
  weightKg: number | null;
  experienceLevel: string;
  weeklyMileageKm: number | null;
  sessionsPerWeek: number;
  recentRaceResults: Array<Record<string, unknown>>;
  preferredTrainingDays: string[];
  availableTrainingDays: string[];
  preferredWorkoutDurationMinutes: number | null;
  birthDate: string | null;
  restingHeartRate: number | null;
  maxHeartRate: number | null;
  thresholdHeartRate: number | null;
  hrZonesMethod: HrZonesMethod;
  hrZonesCustom: number[] | null;
  runningSinceYear: number | null;
  limitations: string | null;
  preferredTimeOfDay: TimeOfDay;
  longRunDay: string | null;
  longRunMaxDurationMinutes: number | null;
  fieldSources: AthleteFieldSources;
  createdAt: Date;
  updatedAt: Date;
}

export interface AthleteStateView {
  id: string;
  athleteId: string;
  fitness: number;
  fatigue: number;
  form: number;
  thresholdPaceSecondsPerKm: number | null;
  thresholdHeartRate: number | null;
  vo2max: number | null;
  weeklyLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  recoveryScore: number | null;
  confidence: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Type-specific metric payload of the universal goal model. */
export interface GoalMetricsPayload {
  current?: Record<string, unknown>;
  target?: Record<string, unknown>;
  description?: string;
}

export interface GoalView {
  id: string;
  athleteId: string;
  /** Universal goal discriminator. */
  type: string;
  /** Type-specific metrics; separate from current state, may be absent. */
  payload: GoalMetricsPayload | null;
  /** Derived legacy race fields kept in sync for existing consumers. */
  raceDistance: AthleteGoalDistance | string;
  targetTimeSeconds: number | null;
  targetDate: string | null;
  priority: number;
  status: AthleteGoalStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutAnalysisView {
  completion: number;
  performanceDelta: number;
  load: number;
  expectedLoad: number;
  fatigueImpact: 'low' | 'moderate' | 'high';
  confidence: number;
  analysisVersion: string;
}

export interface WorkoutView {
  id: string;
  athleteId: string;
  goalId: string | null;
  planId: string | null;
  weekNumber: number;
  scheduledAt: Date;
  type: WorkoutType;
  phase: TrainingPhase | string;
  status: WorkoutStatus;
  orderInWeek: number;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  actual: Record<string, unknown> | null;
  analysis: WorkoutAnalysisView | null;
  completedAt: Date | null;
  /** Shoes the workout was done in; resolved by the client from the gear list. */
  gearId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingPlanWeekView {
  weekNumber: number;
  phase: TrainingPhase | string;
  weeklyLoadTarget: number;
  workoutIds: string[];
}

export interface TrainingPlanView {
  id: string;
  athleteId: string;
  goalId: string | null;
  name: string | null;
  notes: string | null;
  version: number;
  /** Drafts have no dates. */
  startDate: string | null;
  endDate: string | null;
  trainingFrequency: number;
  weeklyTargetKm: number;
  status: TrainingPlanStatus;
  algorithmVersion: string;
  weeks: TrainingPlanWeekView[];
  workouts: WorkoutView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AdaptationEventView {
  id: string;
  athleteId: string;
  planId: string | null;
  workoutId: string | null;
  type: AdaptationAction | string;
  input: Record<string, unknown>;
  decision: Record<string, unknown>;
  reason: string;
  confidence: number;
  /** `applied` — in the plan; `proposed` — waits for the user; `suggested` — advice only; `dismissed`. */
  status?: AdaptationEventStatus;
  createdAt: Date;
}

export interface TrainingLoadView {
  id: string;
  athleteId: string;
  workoutId: string | null;
  occurredAt: Date;
  load: number;
  intensityFactor: number;
  algorithmVersion: string;
}
