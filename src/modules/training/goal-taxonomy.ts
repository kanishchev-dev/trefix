/**
 * Universal training goal taxonomy (PRD "Universal Training Goals").
 *
 * The canonical goal model is polymorphic / discriminated by `type`.
 * Every goal type owns a dedicated subset of metric fields; fields of one
 * goal type must never leak into another goal's payload (PRD sections 9, 13).
 *
 * Canonical units (normalised backend values):
 *  - distances in metres
 *  - durations in seconds (per-workout / results) or minutes (weekly/continuous habits)
 *  - pace in seconds per km
 *  - weight in kilograms
 *  - elevation in metres
 */

export const ATHLETE_GOAL_TYPES = [
  // Race & Event
  'prepare_for_race',
  'improve_race_result',
  'run_new_distance',
  'trail_preparation',
  'ultra_preparation',
  'backyard_preparation',
  // Performance
  'improve_speed',
  'improve_pace',
  'build_endurance',
  'improve_aerobic_fitness',
  'improve_hills',
  // Training habit
  'start_running',
  'return_to_running',
  'build_consistency',
  'increase_running_volume',
  'run_continuously',
  // Fitness & Lifestyle
  'lose_weight',
  'maintain_fitness',
  'general_health',
  // Challenge
  'complete_challenge',
  // Flexible
  'custom',
] as const;

export type AthleteGoalType = (typeof ATHLETE_GOAL_TYPES)[number];

export const ATHLETE_GOAL_CATEGORIES = [
  'race_event',
  'performance',
  'training_habit',
  'fitness_lifestyle',
  'challenge',
  'flexible',
] as const;

export type AthleteGoalCategory = (typeof ATHLETE_GOAL_CATEGORIES)[number];

/** UI grouping (PRD section 6.3): users never see technical enum names. */
export const GOAL_TYPE_CATEGORY: Record<AthleteGoalType, AthleteGoalCategory> = {
  prepare_for_race: 'race_event',
  improve_race_result: 'race_event',
  run_new_distance: 'race_event',
  trail_preparation: 'race_event',
  ultra_preparation: 'race_event',
  backyard_preparation: 'race_event',
  improve_speed: 'performance',
  improve_pace: 'performance',
  build_endurance: 'performance',
  improve_aerobic_fitness: 'performance',
  improve_hills: 'performance',
  start_running: 'training_habit',
  return_to_running: 'training_habit',
  build_consistency: 'training_habit',
  increase_running_volume: 'training_habit',
  run_continuously: 'training_habit',
  lose_weight: 'fitness_lifestyle',
  maintain_fitness: 'fitness_lifestyle',
  general_health: 'fitness_lifestyle',
  complete_challenge: 'challenge',
  custom: 'flexible',
};

/** Metric field keys shared by `current` and `target` metric objects. */
export const GOAL_METRIC_KEYS = [
  'distanceMeters',
  'finishTimeSec',
  'paceSecondsPerKm',
  'weightKg',
  'runsPerWeek',
  'weeklyDistanceKm',
  'weeklyDurationMinutes',
  'continuousDurationMinutes',
  'continuousDistanceKm',
  'elevationGainMeters',
  'shortDistanceResultSec',
  'benchmarkValue',
  'timeOnFeetMinutes',
  'loopsCount',
  'challengeMetric',
  'challengeTargetValue',
  'challengePeriod',
  'challengeProgressValue',
] as const;

export type GoalMetricKey = (typeof GOAL_METRIC_KEYS)[number];

export type GoalChallengeMetric = 'total_distance' | 'total_duration' | 'runs_count' | 'active_days';
export type GoalChallengePeriod = 'this_week' | 'this_month' | 'this_year' | 'custom';

export const GOAL_CHALLENGE_METRICS: readonly GoalChallengeMetric[] = [
  'total_distance',
  'total_duration',
  'runs_count',
  'active_days',
];

export const GOAL_CHALLENGE_PERIODS: readonly GoalChallengePeriod[] = [
  'this_week',
  'this_month',
  'this_year',
  'custom',
];

/**
 * Domain bounds for metric values (PRD section 16: bounds live in the domain
 * layer / configuration, not hardcoded across UI).
 */
export const GOAL_METRIC_BOUNDS: Record<GoalMetricKey, { min: number; max: number; integer?: boolean }> = {
  distanceMeters: { min: 500, max: 300_000, integer: true },
  finishTimeSec: { min: 60, max: 260_000, integer: true },
  paceSecondsPerKm: { min: 120, max: 1_200, integer: true },
  weightKg: { min: 25, max: 350 },
  runsPerWeek: { min: 1, max: 14, integer: true },
  weeklyDistanceKm: { min: 1, max: 400 },
  weeklyDurationMinutes: { min: 20, max: 6_000, integer: true },
  continuousDurationMinutes: { min: 3, max: 1_440, integer: true },
  continuousDistanceKm: { min: 0.5, max: 300 },
  elevationGainMeters: { min: 0, max: 10_000, integer: true },
  shortDistanceResultSec: { min: 5, max: 3_600, integer: true },
  benchmarkValue: { min: 0, max: 10_000 },
  timeOnFeetMinutes: { min: 30, max: 4_320, integer: true },
  loopsCount: { min: 1, max: 100, integer: true },
  challengeMetric: { min: 0, max: 0 },
  challengeTargetValue: { min: 1, max: 100_000 },
  challengePeriod: { min: 0, max: 0 },
  challengeProgressValue: { min: 0, max: 100_000 },
};

export interface GoalTypeConfig {
  /** Fields the target object may carry. */
  targetFields: readonly GoalMetricKey[];
  /** Fields the current object may carry. */
  currentFields: readonly GoalMetricKey[];
  /**
   * Required target alternatives: every inner group is an AND-group; the goal
   * is valid when at least one field of every group is present. An empty array
   * means the type needs no numeric target (intent-only goals).
   */
  requiredTargetGroups: readonly (readonly GoalMetricKey[])[];
  /** Custom goals require a free-text description (PRD section 8.21). */
  requiresDescription?: boolean;
}

const T: Record<string, readonly GoalMetricKey[]> = {
  distance: ['distanceMeters'],
  finishTime: ['finishTimeSec'],
  pace: ['paceSecondsPerKm'],
  weight: ['weightKg'],
  runsPerWeek: ['runsPerWeek'],
  weeklyVolume: ['weeklyDistanceKm', 'weeklyDurationMinutes'],
  continuous: ['continuousDurationMinutes', 'continuousDistanceKm'],
};

const RACE_CURRENT: readonly GoalMetricKey[] = ['distanceMeters', 'finishTimeSec', 'paceSecondsPerKm'];

/** Goal configuration matrix (PRD section 8). */
export const GOAL_TYPE_CONFIG: Record<AthleteGoalType, GoalTypeConfig> = {
  prepare_for_race: {
    // Distance required; target finish time intentionally optional (finish the race).
    targetFields: [...T.distance, ...T.finishTime],
    currentFields: [...RACE_CURRENT],
    requiredTargetGroups: [T.distance],
  },
  improve_race_result: {
    targetFields: [...T.distance, ...T.finishTime],
    currentFields: [...RACE_CURRENT],
    requiredTargetGroups: [T.distance, T.finishTime],
  },
  run_new_distance: {
    targetFields: [...T.distance],
    currentFields: [...RACE_CURRENT],
    requiredTargetGroups: [T.distance],
  },
  trail_preparation: {
    targetFields: ['distanceMeters', 'elevationGainMeters'],
    currentFields: ['distanceMeters', 'elevationGainMeters', 'weeklyDistanceKm'],
    requiredTargetGroups: [T.distance],
  },
  ultra_preparation: {
    targetFields: ['distanceMeters', 'elevationGainMeters'],
    currentFields: ['distanceMeters', 'weeklyDistanceKm'],
    requiredTargetGroups: [T.distance],
  },
  backyard_preparation: {
    // Backyard is its own event type; never modelled through one target distance.
    targetFields: ['loopsCount', 'timeOnFeetMinutes', 'distanceMeters'],
    currentFields: ['timeOnFeetMinutes', 'distanceMeters'],
    requiredTargetGroups: [],
  },
  improve_speed: {
    // A numeric target is optional: the type itself carries the intent.
    targetFields: ['shortDistanceResultSec', 'paceSecondsPerKm', 'benchmarkValue'],
    currentFields: ['shortDistanceResultSec', 'paceSecondsPerKm', 'benchmarkValue'],
    requiredTargetGroups: [],
  },
  improve_pace: {
    targetFields: [...T.pace, 'distanceMeters'],
    currentFields: [...T.pace, ...T.distance],
    requiredTargetGroups: [T.pace],
  },
  build_endurance: {
    targetFields: [...T.continuous],
    currentFields: ['continuousDurationMinutes', 'continuousDistanceKm', 'distanceMeters'],
    requiredTargetGroups: [T.continuous],
  },
  improve_aerobic_fitness: {
    targetFields: ['benchmarkValue'],
    currentFields: ['benchmarkValue'],
    requiredTargetGroups: [],
  },
  improve_hills: {
    targetFields: ['elevationGainMeters', 'continuousDurationMinutes'],
    currentFields: ['elevationGainMeters', 'benchmarkValue'],
    requiredTargetGroups: [],
  },
  start_running: {
    targetFields: ['continuousDurationMinutes', 'continuousDistanceKm'],
    currentFields: ['continuousDurationMinutes', 'continuousDistanceKm'],
    // Empty current state is an important scenario: no metrics required.
    requiredTargetGroups: [],
  },
  return_to_running: {
    targetFields: ['weeklyDistanceKm', 'continuousDurationMinutes'],
    currentFields: ['weeklyDistanceKm', 'continuousDurationMinutes', 'continuousDistanceKm'],
    requiredTargetGroups: [],
  },
  build_consistency: {
    targetFields: [...T.runsPerWeek],
    currentFields: [...T.runsPerWeek],
    requiredTargetGroups: [T.runsPerWeek],
  },
  increase_running_volume: {
    targetFields: [...T.weeklyVolume],
    currentFields: [...T.weeklyVolume],
    requiredTargetGroups: [T.weeklyVolume],
  },
  run_continuously: {
    targetFields: [...T.continuous],
    currentFields: [...T.continuous],
    requiredTargetGroups: [T.continuous],
  },
  lose_weight: {
    targetFields: [...T.weight],
    currentFields: [...T.weight],
    requiredTargetGroups: [T.weight],
  },
  maintain_fitness: {
    targetFields: ['runsPerWeek', 'weeklyDistanceKm'],
    currentFields: ['runsPerWeek', 'weeklyDistanceKm'],
    requiredTargetGroups: [],
  },
  general_health: {
    targetFields: ['runsPerWeek', 'weeklyDurationMinutes'],
    currentFields: ['runsPerWeek'],
    requiredTargetGroups: [],
  },
  complete_challenge: {
    targetFields: ['challengeMetric', 'challengeTargetValue', 'challengePeriod'],
    currentFields: ['challengeProgressValue'],
    requiredTargetGroups: [['challengeMetric', 'challengeTargetValue'] as readonly GoalMetricKey[]],
  },
  custom: {
    targetFields: [],
    currentFields: [],
    requiredTargetGroups: [],
    requiresDescription: true,
  },
};

export type GoalValidationCode =
  | 'GOAL_TYPE_UNKNOWN'
  | 'GOAL_TARGET_REQUIRED'
  | 'GOAL_METRIC_NOT_ALLOWED'
  | 'GOAL_METRIC_RANGE'
  | 'GOAL_DESCRIPTION_REQUIRED'
  | 'GOAL_CHALLENGE_METRIC_INVALID';

export interface GoalPayloadShape {
  type: AthleteGoalType;
  current?: Record<string, unknown> | null;
  target?: Record<string, unknown> | null;
  description?: string | null;
}

export interface GoalValidationResult {
  valid: boolean;
  code?: GoalValidationCode;
  field?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateMetricObject(
  goalType: AthleteGoalType,
  kind: 'target' | 'current',
  metrics: Record<string, unknown>,
): GoalValidationResult {
  const config = GOAL_TYPE_CONFIG[goalType];
  const allowedFields = kind === 'target' ? config.targetFields : config.currentFields;

  for (const [field, value] of Object.entries(metrics)) {
    if (!allowedFields.includes(field as GoalMetricKey)) {
      // Fields of one goal type must not pollute another (PRD section 9.4).
      return { valid: false, code: 'GOAL_METRIC_NOT_ALLOWED', field };
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (field === 'challengeMetric') {
      if (!GOAL_CHALLENGE_METRICS.includes(value as GoalChallengeMetric)) {
        return { valid: false, code: 'GOAL_CHALLENGE_METRIC_INVALID', field };
      }
      continue;
    }

    if (field === 'challengePeriod') {
      if (!GOAL_CHALLENGE_PERIODS.includes(value as GoalChallengePeriod)) {
        return { valid: false, code: 'GOAL_METRIC_RANGE', field };
      }
      continue;
    }

    const bounds = GOAL_METRIC_BOUNDS[field as GoalMetricKey];
    if (!bounds || !isFiniteNumber(value)) {
      return { valid: false, code: 'GOAL_METRIC_RANGE', field };
    }

    if (bounds.integer && !Number.isInteger(value)) {
      return { valid: false, code: 'GOAL_METRIC_RANGE', field };
    }

    if (value < bounds.min || value > bounds.max) {
      return { valid: false, code: 'GOAL_METRIC_RANGE', field };
    }
  }

  return { valid: true };
}

/**
 * Schema-aware goal validation (PRD section 14). One race schema for every
 * goal is explicitly not allowed: required/optional fields follow the matrix.
 */
export function validateGoalPayload(goal: GoalPayloadShape): GoalValidationResult {
  const config = GOAL_TYPE_CONFIG[goal.type];
  if (!config) {
    return { valid: false, code: 'GOAL_TYPE_UNKNOWN' };
  }

  if (config.requiresDescription && !(typeof goal.description === 'string' && goal.description.trim().length > 0)) {
    return { valid: false, code: 'GOAL_DESCRIPTION_REQUIRED' };
  }

  const target = goal.target ?? {};
  const current = goal.current ?? {};

  const targetResult = validateMetricObject(goal.type, 'target', target);
  if (!targetResult.valid) {
    return targetResult;
  }

  const currentResult = validateMetricObject(goal.type, 'current', current);
  if (!currentResult.valid) {
    return currentResult;
  }

  for (const group of config.requiredTargetGroups) {
    const satisfied = group.some((field) => {
      const value = target[field];
      return value !== undefined && value !== null;
    });
    if (!satisfied) {
      return { valid: false, code: 'GOAL_TARGET_REQUIRED', field: group[0] };
    }
  }

  return { valid: true };
}

/** Legacy race-distance presets kept for backward compatibility (PRD section 26). */
export const LEGACY_RACE_DISTANCE_METERS: Record<string, number> = {
  '5k': 5_000,
  '10k': 10_000,
  half_marathon: 21_097,
  marathon: 42_195,
};

export const LEGACY_RACE_DISTANCE_VALUES = ['5k', '10k', 'half_marathon', 'marathon', 'just_running'] as const;

/**
 * Maps a legacy race goal (race distance + optional target time) onto the
 * universal model. The intent is never invented: a stored target time maps to
 * `improve_race_result`, otherwise the safe `prepare_for_race` default.
 */
export function mapLegacyRaceGoal(
  raceDistance: string,
  targetTimeSeconds: number | null | undefined,
): { type: AthleteGoalType; target: Record<string, unknown> } {
  const distanceMeters = LEGACY_RACE_DISTANCE_METERS[raceDistance];
  const target: Record<string, unknown> = {};
  if (distanceMeters) {
    target.distanceMeters = distanceMeters;
  }
  if (targetTimeSeconds && distanceMeters) {
    return { type: 'improve_race_result', target: { ...target, finishTimeSec: targetTimeSeconds } };
  }
  return { type: 'prepare_for_race', target };
}

/**
 * Derives the legacy `race_distance` / `target_time_seconds` columns from a
 * universal goal so existing consumers (plan overview, coach, progress)
 * keep working without a breaking redesign.
 */
export function deriveLegacyRaceFields(goal: GoalPayloadShape): {
  raceDistance: (typeof LEGACY_RACE_DISTANCE_VALUES)[number];
  targetTimeSeconds: number | null;
} {
  const distanceMeters = goal.target?.distanceMeters;
  const finishTimeSec = goal.target?.finishTimeSec;
  const targetTimeSeconds = isFiniteNumber(finishTimeSec) ? finishTimeSec : null;

  if (typeof distanceMeters === 'number') {
    const matched = Object.entries(LEGACY_RACE_DISTANCE_METERS).find(
      ([, meters]) => Math.abs(meters - distanceMeters) < 1,
    );
    if (matched) {
      return { raceDistance: matched[0] as (typeof LEGACY_RACE_DISTANCE_VALUES)[number], targetTimeSeconds };
    }
  }

  return { raceDistance: 'just_running', targetTimeSeconds };
}
