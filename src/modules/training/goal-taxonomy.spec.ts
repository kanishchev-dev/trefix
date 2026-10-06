import { deriveLegacyRaceFields, mapLegacyRaceGoal, validateGoalPayload } from './goal-taxonomy';

describe('goal taxonomy validation', () => {
  it('accepts a race goal with distance only (finish the race, no target time)', () => {
    const result = validateGoalPayload({
      type: 'prepare_for_race',
      target: { distanceMeters: 10_000 },
    });

    expect(result.valid).toBe(true);
  });

  it('requires distance and target time for improve_race_result', () => {
    const missingTime = validateGoalPayload({
      type: 'improve_race_result',
      target: { distanceMeters: 10_000 },
    });
    expect(missingTime.valid).toBe(false);
    expect(missingTime.code).toBe('GOAL_TARGET_REQUIRED');

    const valid = validateGoalPayload({
      type: 'improve_race_result',
      current: { finishTimeSec: 2910 },
      target: { distanceMeters: 10_000, finishTimeSec: 2700 },
    });
    expect(valid.valid).toBe(true);
  });

  it('requires target weight for lose_weight and rejects race fields', () => {
    const missing = validateGoalPayload({ type: 'lose_weight', target: {} });
    expect(missing.valid).toBe(false);
    expect(missing.code).toBe('GOAL_TARGET_REQUIRED');

    const polluted = validateGoalPayload({
      type: 'lose_weight',
      target: { weightKg: 75, distanceMeters: 10_000 },
    });
    expect(polluted.valid).toBe(false);
    expect(polluted.code).toBe('GOAL_METRIC_NOT_ALLOWED');
    expect(polluted.field).toBe('distanceMeters');
  });

  it('validates build_consistency through runs per week', () => {
    expect(validateGoalPayload({ type: 'build_consistency', target: { runsPerWeek: 4 } }).valid).toBe(true);

    expect(
      validateGoalPayload({ type: 'build_consistency', current: { runsPerWeek: 2 }, target: { runsPerWeek: 4 } }).valid,
    ).toBe(true);

    const invalid = validateGoalPayload({ type: 'build_consistency', target: { runsPerWeek: 0 } });
    expect(invalid.valid).toBe(false);
    expect(invalid.code).toBe('GOAL_METRIC_RANGE');
  });

  it('allows volume goals through weekly distance or weekly duration', () => {
    expect(validateGoalPayload({ type: 'increase_running_volume', target: { weeklyDistanceKm: 40 } }).valid).toBe(true);
    expect(validateGoalPayload({ type: 'increase_running_volume', target: { weeklyDurationMinutes: 240 } }).valid).toBe(
      true,
    );
    expect(validateGoalPayload({ type: 'increase_running_volume', target: {} }).valid).toBe(false);
  });

  it('allows intent-only goals without a numeric target', () => {
    for (const type of [
      'maintain_fitness',
      'general_health',
      'improve_speed',
      'improve_aerobic_fitness',
      'start_running',
      'return_to_running',
      'improve_hills',
    ] as const) {
      expect(validateGoalPayload({ type, target: {} }).valid).toBe(true);
    }
  });

  it('validates optional current metrics when provided', () => {
    const result = validateGoalPayload({
      type: 'lose_weight',
      current: { weightKg: -20 },
      target: { weightKg: 75 },
    });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('GOAL_METRIC_RANGE');
    expect(result.field).toBe('weightKg');
  });

  it('rejects unknown goal types', () => {
    const result = validateGoalPayload({ type: 'unsupported_goal' as never, target: {} });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('GOAL_TYPE_UNKNOWN');
  });

  it('requires a description for custom goals and forbids hidden metrics', () => {
    const empty = validateGoalPayload({ type: 'custom', description: '   ' });
    expect(empty.valid).toBe(false);
    expect(empty.code).toBe('GOAL_DESCRIPTION_REQUIRED');

    const withHiddenMetrics = validateGoalPayload({
      type: 'custom',
      description: 'Run with my club twice a week',
      target: { distanceMeters: 10_000 },
    });
    expect(withHiddenMetrics.valid).toBe(false);
    expect(withHiddenMetrics.code).toBe('GOAL_METRIC_NOT_ALLOWED');
  });

  it('validates challenge goals', () => {
    const valid = validateGoalPayload({
      type: 'complete_challenge',
      target: { challengeMetric: 'total_distance', challengeTargetValue: 100, challengePeriod: 'this_month' },
      current: { challengeProgressValue: 24 },
    });
    expect(valid.valid).toBe(true);

    const invalidMetric = validateGoalPayload({
      type: 'complete_challenge',
      target: { challengeMetric: 'marathons', challengeTargetValue: 2 },
    });
    expect(invalidMetric.valid).toBe(false);
    expect(invalidMetric.code).toBe('GOAL_CHALLENGE_METRIC_INVALID');
  });

  it('distinguishes backyard from ultra goals', () => {
    const backyard = validateGoalPayload({
      type: 'backyard_preparation',
      target: { loopsCount: 18 },
    });
    expect(backyard.valid).toBe(true);

    // Backyard does not accept a plain target distance as its loop semantics.
    const polluted = validateGoalPayload({
      type: 'backyard_preparation',
      target: { loopsCount: 18, elevationGainMeters: 3000 },
    });
    expect(polluted.valid).toBe(false);
  });

  it('maps legacy race goals without inventing intent', () => {
    expect(mapLegacyRaceGoal('10k', 2700)).toEqual({
      type: 'improve_race_result',
      target: { distanceMeters: 10_000, finishTimeSec: 2700 },
    });

    expect(mapLegacyRaceGoal('10k', null)).toEqual({
      type: 'prepare_for_race',
      target: { distanceMeters: 10_000 },
    });

    expect(mapLegacyRaceGoal('just_running', null)).toEqual({
      type: 'prepare_for_race',
      target: {},
    });
  });

  it('derives legacy race fields for existing consumers', () => {
    expect(
      deriveLegacyRaceFields({ type: 'improve_race_result', target: { distanceMeters: 10_000, finishTimeSec: 2700 } }),
    ).toEqual({ raceDistance: '10k', targetTimeSeconds: 2700 });

    expect(deriveLegacyRaceFields({ type: 'lose_weight', target: { weightKg: 75 } })).toEqual({
      raceDistance: 'just_running',
      targetTimeSeconds: null,
    });
  });
});
