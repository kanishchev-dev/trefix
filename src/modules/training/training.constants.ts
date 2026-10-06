export const TRAINING_MODULE_NAME = 'TrainingModule';

export const TRAINING_LOAD_ALGORITHM_VERSION = 'v1';
export const TRAINING_STATE_SOURCE = 'deterministic_v1';

export const ATHLETE_EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const ATHLETE_SEX_VALUES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
export const ATHLETE_GOAL_DISTANCES = ['5k', '10k', 'half_marathon', 'marathon', 'just_running'] as const;
export const ATHLETE_GOAL_STATUSES = ['active', 'completed', 'paused', 'cancelled'] as const;
export const TRAINING_PLAN_STATUSES = ['draft', 'active', 'completed', 'paused', 'cancelled'] as const;

/** List groups of the plans library screen. */
export const PLAN_LIST_GROUPS = ['draft', 'active', 'history'] as const;
/** Why a plan left the `active` state. */
export const PLAN_CANCEL_REASONS = ['replaced', 'user', 'migration'] as const;

export const PLAN_NAME_MAX_LENGTH = 80;
export const PLAN_NOTES_MAX_LENGTH = 2000;
/** Default per-athlete cap over all statuses; overridable via config. */
export const PLANS_PER_ATHLETE_LIMIT = 100;
export const PLAN_START_MAX_DAYS_AHEAD = 365;
export const REBUILD_VOLUME_SCALE_MIN = 0.6;
export const REBUILD_VOLUME_SCALE_MAX = 1.3;
/** Drafts older than this show the "metrics may be stale" hint. */
export const DRAFT_METRICS_STALE_DAYS = 28;
/** Kinds of active-plan edits. */
export const PLAN_CHANGE_KINDS = ['workouts', 'schedule', 'goal_date'] as const;
export const WORKOUT_OPERATION_KINDS = ['update', 'move', 'remove', 'add'] as const;
export const PLAN_CHANGE_MAX_OPERATIONS = 50;
/** Default hourly limit of plan creations per user; overridable via TRAINING_PLAN_CREATE_RATE_LIMIT. */
export const PLAN_CREATE_RATE_LIMIT_DEFAULT = 30;
export const PLAN_CREATE_RATE_TTL_MS = 3_600_000;
/** Adaptation-event type used to log user edits of a plan. */
export const ADAPTATION_TYPE_USER_EDIT = 'user_edit';

/** Accepted metric ranges for plan start / rebuild. */
export const PLAN_METRIC_RANGES = {
  thresholdPaceSecondsPerKm: { min: 150, max: 600 },
  weeklyMileageKm: { min: 0, max: 300 },
  longestRunKm: { min: 0, max: 200 },
  maxHeartRate: { min: 120, max: 230 },
  restingHeartRate: { min: 30, max: 100 },
} as const;
export const PLAN_CREATION_SOURCES = ['ai', 'manual'] as const;
export const PLAN_CREATION_SOURCE_DEFAULT = 'ai' as const;

export const MANUAL_PLAN_MIN_WEEKS = 4;
export const MANUAL_PLAN_MAX_WEEKS = 16;
export const MANUAL_PLAN_MIN_DURATION_MINUTES = 10;
export const MANUAL_PLAN_MAX_DURATION_MINUTES = 300;
export const MANUAL_PLAN_MAX_DISTANCE_KM = 100;
export const MANUAL_PLAN_FOCUS_TYPES = ['easy', 'long_run', 'tempo', 'interval', 'hill'] as const;
export const WORKOUT_STATUSES = ['planned', 'completed', 'skipped', 'cancelled'] as const;
export const WORKOUT_TYPES = [
  'recovery',
  'easy',
  'long_run',
  'tempo',
  'threshold',
  'interval',
  'hill',
  'race',
  'rest',
] as const;
export const TRAINING_PHASES = ['base', 'build', 'recovery', 'specific', 'peak', 'taper', 'race'] as const;
export const ADAPTATION_ACTIONS = [
  'KEEP',
  'MOVE',
  'REDUCE_VOLUME',
  'REDUCE_INTENSITY',
  'INCREASE_VOLUME',
  'INCREASE_INTENSITY',
  'REPLACE',
  'ADD_RECOVERY',
  'REGENERATE_PLAN',
] as const;

export const WORKOUT_TYPE_INTENSITY_FACTORS: Record<(typeof WORKOUT_TYPES)[number], number> = {
  recovery: 0.6,
  easy: 0.7,
  long_run: 0.8,
  tempo: 1.0,
  threshold: 1.15,
  interval: 1.3,
  hill: 1.25,
  race: 1.4,
  rest: 0.1,
};

export const TRAINING_PHASE_WEEKLY_LOAD_MULTIPLIERS: Record<(typeof TRAINING_PHASES)[number], number> = {
  base: 0.85,
  build: 1.0,
  recovery: 0.75,
  specific: 1.05,
  peak: 0.95,
  taper: 0.65,
  race: 0.4,
};

export const TRAINING_PHASE_WORKOUT_TYPES: Record<
  (typeof TRAINING_PHASES)[number],
  Array<(typeof WORKOUT_TYPES)[number]>
> = {
  base: ['easy', 'long_run', 'tempo', 'recovery'],
  build: ['easy', 'threshold', 'interval', 'long_run'],
  recovery: ['recovery', 'easy', 'rest'],
  specific: ['tempo', 'threshold', 'interval', 'long_run'],
  peak: ['threshold', 'interval', 'easy', 'long_run'],
  taper: ['easy', 'tempo', 'recovery', 'rest'],
  race: ['easy', 'race', 'recovery', 'rest'],
};

export const TRAINING_WEEKDAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const TRAINING_DEFAULT_AVAILABILITY = ['tuesday', 'thursday', 'saturday', 'sunday'] as const;

export const TRAINING_DEFAULT_FREQUENCY = 4;
export const TRAINING_DEFAULT_DURATION_MINUTES = 45;
export const TRAINING_DEFAULT_WEEKLY_MILEAGE_KM = 30;
export const TRAINING_DEFAULT_TARGET_CONFIDENCE = 0.6;

export type AthleteExperienceLevel = (typeof ATHLETE_EXPERIENCE_LEVELS)[number];
export type AthleteSexValue = (typeof ATHLETE_SEX_VALUES)[number];
export type AthleteGoalDistance = (typeof ATHLETE_GOAL_DISTANCES)[number];
export type AthleteGoalStatus = (typeof ATHLETE_GOAL_STATUSES)[number];
export type TrainingPlanStatus = (typeof TRAINING_PLAN_STATUSES)[number];
export type PlanListGroup = (typeof PLAN_LIST_GROUPS)[number];
export type PlanCancelReason = (typeof PLAN_CANCEL_REASONS)[number];
/** Where a metrics value came from, reported per field to the client. */
export type PlanMetricsSource = 'user_input' | 'athlete_state' | 'strava' | 'manual_workouts' | 'none';
export type PlanCreationSource = (typeof PLAN_CREATION_SOURCES)[number];
export type ManualPlanFocusType = (typeof MANUAL_PLAN_FOCUS_TYPES)[number];
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];
export type WorkoutType = (typeof WORKOUT_TYPES)[number];
export type TrainingPhase = (typeof TRAINING_PHASES)[number];
export type AdaptationAction = (typeof ADAPTATION_ACTIONS)[number];
