export const TRAINING_MODULE_NAME = 'TrainingModule';

export const TRAINING_LOAD_ALGORITHM_VERSION = 'v1';
export const TRAINING_STATE_SOURCE = 'deterministic_v1';

export const ATHLETE_EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const ATHLETE_SEX_VALUES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
export const ATHLETE_GOAL_DISTANCES = ['5k', '10k', 'half_marathon', 'marathon'] as const;
export const ATHLETE_GOAL_STATUSES = ['active', 'completed', 'paused'] as const;
export const TRAINING_PLAN_STATUSES = ['draft', 'active', 'completed', 'paused'] as const;
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
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];
export type WorkoutType = (typeof WORKOUT_TYPES)[number];
export type TrainingPhase = (typeof TRAINING_PHASES)[number];
export type AdaptationAction = (typeof ADAPTATION_ACTIONS)[number];
