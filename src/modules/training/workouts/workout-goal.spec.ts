import { goalPaceCorridor, resolveWorkoutGoal } from './workout-goal';

describe('resolveWorkoutGoal', () => {
  it('keeps the other value empty instead of estimating it', () => {
    expect(resolveWorkoutGoal({ goal: 'duration', durationMinutes: 50, distanceKm: 8 })).toEqual({
      durationMinutes: 50,
      distanceKm: 0,
      target: { goal: 'duration' },
    });
    expect(resolveWorkoutGoal({ goal: 'distance', distanceKm: 8 })).toEqual({
      durationMinutes: 0,
      distanceKm: 8,
      target: { goal: 'distance' },
    });
    expect(resolveWorkoutGoal({ goal: 'none', durationMinutes: 30 })).toEqual({
      durationMinutes: 0,
      distanceKm: 0,
      target: { goal: 'none' },
    });
  });

  it('stores a time limit of a distance goal as its duration', () => {
    expect(resolveWorkoutGoal({ goal: 'distance', distanceKm: 8, timeLimitMin: 50 })).toEqual({
      durationMinutes: 50,
      distanceKm: 8,
      target: { goal: 'distance', timeLimitMin: 50 },
    });
  });

  it('returns null for requests without a goal', () => {
    expect(resolveWorkoutGoal({ durationMinutes: 30, distanceKm: 5 })).toBeNull();
  });

  it('rejects a goal without its value and a time limit without a distance goal', () => {
    expect(() => resolveWorkoutGoal({ goal: 'duration' })).toThrow();
    expect(() => resolveWorkoutGoal({ goal: 'distance', distanceKm: 0 })).toThrow();
    expect(() => resolveWorkoutGoal({ goal: 'duration', durationMinutes: 40, timeLimitMin: 40 })).toThrow();
    expect(() => resolveWorkoutGoal({ timeLimitMin: 40 })).toThrow();
  });
});

describe('goalPaceCorridor', () => {
  it('builds ±5 s around the even pace', () => {
    expect(goalPaceCorridor(8, 50)).toEqual({ minSecPerKm: 370, maxSecPerKm: 380 });
  });
});
