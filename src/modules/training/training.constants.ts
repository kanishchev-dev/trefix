export const TRAINING_MODULE_NAME = 'TrainingModule';

export const TRAINING_LOAD_ALGORITHM_VERSION = 'v1';
export const TRAINING_STATE_SOURCE = 'deterministic_v1';

export const ATHLETE_EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const ATHLETE_SEX_VALUES = ['female', 'male'] as const;
export const ATHLETE_GOAL_DISTANCES = ['5k', '10k', 'half_marathon', 'marathon', 'just_running'] as const;
export const ATHLETE_GOAL_STATUSES = ['active', 'completed', 'paused', 'cancelled'] as const;
export const TRAINING_PLAN_STATUSES = ['draft', 'active', 'completed', 'paused', 'cancelled'] as const;

/** List groups of the plans library screen. */
export const PLAN_LIST_GROUPS = ['draft', 'active', 'history'] as const;
/** Why a plan left the `active` state. */
export const PLAN_CANCEL_REASONS = ['replaced', 'user', 'admin', 'migration'] as const;

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
/** Adaptation-event type for heart-rate targets updated after the zones changed. */
export const ADAPTATION_TYPE_HEART_RATE = 'UPDATE_HEART_RATE';

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

/** Accepted ranges of athlete profile fields (metric units). */
export const ATHLETE_RANGES = {
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 250 },
  restingHeartRate: PLAN_METRIC_RANGES.restingHeartRate,
  maxHeartRate: PLAN_METRIC_RANGES.maxHeartRate,
  thresholdHeartRate: { min: 100, max: 220 },
  sessionsPerWeek: { min: 1, max: 7 },
  weeklyMileageKm: PLAN_METRIC_RANGES.weeklyMileageKm,
  preferredWorkoutDurationMinutes: { min: 15, max: 240 },
  longRunMaxDurationMinutes: { min: 30, max: 360 },
  runningSinceYear: { min: 1950 },
  ageYears: { min: 10, max: 100 },
} as const;
export const ATHLETE_LIMITATIONS_MAX_LENGTH = 500;
export const HR_ZONES_METHODS = ['threshold', 'max_hr', 'custom'] as const;
export const HR_ZONES_METHOD_DEFAULT = 'max_hr' as const;
/** Upper bounds of Z1–Z4 as a share of LTHR (Friel). Z5 runs up to max HR. */
export const HR_ZONES_THRESHOLD_SHARES = [0.81, 0.89, 0.93, 0.99] as const;
/** Upper bounds of Z1–Z4 as a share of max HR. */
export const HR_ZONES_MAX_HR_SHARES = [0.6, 0.7, 0.8, 0.9] as const;
export const TIMES_OF_DAY = ['morning', 'day', 'evening', 'any'] as const;
/** Profile fields an external source (Strava, Apple Health, Health Connect) may fill in. */
export const ATHLETE_SOURCED_FIELDS = ['weightKg', 'sex', 'heightCm', 'birthDate', 'restingHeartRate'] as const;
/** Plan inputs whose manual value takes priority over estimates from workouts. */
export const ATHLETE_MANUAL_TRACKED_FIELDS = [
  'restingHeartRate',
  'maxHeartRate',
  'thresholdHeartRate',
  'weeklyMileageKm',
] as const;
export const FIELD_SOURCES = ['manual', 'strava', 'apple_health', 'health_connect'] as const;
/** A fact-based weekly volume is suggested when it differs from the profile by more than this share. */
export const WEEKLY_MILEAGE_SUGGESTION_THRESHOLD = 0.1;

export const GEAR_TYPES = ['shoes', 'watch', 'sensor'] as const;
/** Gear that records workouts; shoes only accumulate mileage. */
export const GEAR_DEVICE_TYPES = ['watch', 'sensor'] as const;
/** Where workouts recorded by a device reach Trefix from. */
export const GEAR_DATA_SOURCES = ['strava', 'garmin', 'apple_health', 'health_connect'] as const;
/** Imported run counts as a long run from this distance, or when it beats the recent average by the factor. */
export const IMPORTED_LONG_RUN_MIN_KM = 16;
export const IMPORTED_LONG_RUN_FACTOR = 1.4;
export const IMPORTED_LONG_RUN_WINDOW_DAYS = 28;

export const GEAR_SOURCES = ['manual', 'strava'] as const;
export const GEAR_STATUSES = ['active', 'retired'] as const;
export const GEAR_LIMIT_KM_RANGE = { min: 100, max: 2000 } as const;
export const GEAR_LIMIT_KM_DEFAULT = 700;
export const GEAR_INITIAL_DISTANCE_MAX_KM = 10_000;
/** A pair is due for replacement when this share of its limit is left. */
export const GEAR_REPLACE_THRESHOLD = 0.1;
export const GEAR_BRAND_MAX_LENGTH = 60;
export const GEAR_MODEL_MAX_LENGTH = 80;
export const GEAR_NICKNAME_MAX_LENGTH = 60;

export const RACE_RESULT_KINDS = ['race', 'workout', 'test'] as const;
export const PROGRESS_PERIODS = ['4W', '8W', '3M', '6M', '1Y'] as const;
export const RECORD_DISTANCES = {
  '1k': 1000,
  '5k': 5000,
  '10k': 10000,
  half_marathon: 21097.5,
  marathon: 42195,
} as const;
export const PROGRESS_METRICS = ['threshold_pace', 'vo2max'] as const;
/** Completed workouts within 42 days needed before form and threshold metrics are shown. */
export const PROGRESS_METRICS_MIN_WORKOUTS = 6;

export const ADAPTATION_EVENT_STATUSES = ['applied', 'proposed', 'suggested', 'dismissed'] as const;

export type AthleteExperienceLevel = (typeof ATHLETE_EXPERIENCE_LEVELS)[number];
/** Where a metrics value came from, reported per field to the client. */
export const PLAN_METRICS_SOURCES = [
  'user_input',
  'profile',
  'athlete_state',
  'strava',
  'health',
  'manual_workouts',
  'none',
] as const;

export type AthleteSexValue = (typeof ATHLETE_SEX_VALUES)[number];
export type AthleteGoalDistance = (typeof ATHLETE_GOAL_DISTANCES)[number];
export type AthleteGoalStatus = (typeof ATHLETE_GOAL_STATUSES)[number];
export type TrainingPlanStatus = (typeof TRAINING_PLAN_STATUSES)[number];
export type PlanListGroup = (typeof PLAN_LIST_GROUPS)[number];
export type PlanCancelReason = (typeof PLAN_CANCEL_REASONS)[number];
export type PlanMetricsSource = (typeof PLAN_METRICS_SOURCES)[number];
export type PlanCreationSource = (typeof PLAN_CREATION_SOURCES)[number];
export type ManualPlanFocusType = (typeof MANUAL_PLAN_FOCUS_TYPES)[number];
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];
export type WorkoutType = (typeof WORKOUT_TYPES)[number];
export type TrainingPhase = (typeof TRAINING_PHASES)[number];
export type AdaptationAction = (typeof ADAPTATION_ACTIONS)[number];
export type HrZonesMethod = (typeof HR_ZONES_METHODS)[number];
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];
export type AthleteSourcedField = (typeof ATHLETE_SOURCED_FIELDS)[number];
export type FieldSource = (typeof FIELD_SOURCES)[number];
export type TrainingWeekday = (typeof TRAINING_WEEKDAY_ORDER)[number];
export type GearType = (typeof GEAR_TYPES)[number];
export type GearSource = (typeof GEAR_SOURCES)[number];
export type GearDataSource = (typeof GEAR_DATA_SOURCES)[number];
export type GearStatus = (typeof GEAR_STATUSES)[number];
export type AdaptationEventStatus = (typeof ADAPTATION_EVENT_STATUSES)[number];
/** Per-field provenance stored in `athletes.field_sources`. */
export type AthleteFieldSources = Partial<Record<string, { source: FieldSource; updatedAt: string }>>;
export type RaceResultKind = (typeof RACE_RESULT_KINDS)[number];
export type ProgressPeriodKey = (typeof PROGRESS_PERIODS)[number];
export type RecordDistance = keyof typeof RECORD_DISTANCES;
export type ProgressMetric = (typeof PROGRESS_METRICS)[number];
