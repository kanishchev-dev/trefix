import { WorkoutExecutionBuilder } from './workout-execution.builder';

const target = { paceMinSecondsPerKm: 280, paceMaxSecondsPerKm: 290, zone: 'Z4' };
const base = { id: 'w-1', durationMinutes: 50, distanceKm: 10, target };

describe('WorkoutExecutionBuilder', () => {
  const builder = new WorkoutExecutionBuilder();

  it('expands repeats with rest between them', () => {
    const result = builder.build({
      ...base,
      type: 'interval',
      steps: [
        { type: 'warmup', durationMinutes: 10 },
        { type: 'interval', durationMinutes: 25, repetitions: 5, target },
        { type: 'recovery', durationMinutes: 8 },
        { type: 'cooldown', durationMinutes: 7 },
      ],
    });

    expect(result.steps.map((step) => step.kind)).toEqual([
      'warmup',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'cooldown',
    ]);
    const work = result.steps.filter((step) => step.kind === 'work');
    expect(work[0]).toMatchObject({ durationSec: 300, targetPace: { minSecPerKm: 280, maxSecPerKm: 290 }, zone: 'Z4' });
    expect(work[4]?.repetition).toEqual({ index: 5, total: 5 });
    expect(result.steps[2]).toMatchObject({ kind: 'recovery', durationSec: 120, targetPace: null });
    expect(result.steps.map((step) => step.index)).toEqual([...result.steps.keys()]);
    expect(result.totalDurationSec).toBe(600 + 5 * 300 + 4 * 120 + 420);
    expect(result.totalDistanceM).toBeNull();
  });

  it('keeps a short rest at least a minute long', () => {
    const result = builder.build({
      ...base,
      type: 'hill',
      steps: [
        { type: 'hill', durationMinutes: 16, repetitions: 8, target },
        { type: 'recovery', durationMinutes: 2 },
      ],
    });
    expect(result.steps.find((step) => step.kind === 'recovery')?.durationSec).toBe(60);
  });

  it('leads an easy run as one steady block between warmup and cooldown', () => {
    const result = builder.build({
      ...base,
      type: 'easy',
      steps: [
        { type: 'warmup', durationMinutes: 8 },
        { type: 'easy', durationMinutes: 35, target },
        { type: 'cooldown', durationMinutes: 7 },
      ],
    });
    expect(result.steps.map((step) => step.kind)).toEqual(['warmup', 'steady', 'cooldown']);
    expect(result.steps[1]).toMatchObject({ durationSec: 2100, repetition: null });
  });

  it('treats a recovery run with a target as the main block', () => {
    const result = builder.build({
      ...base,
      type: 'recovery',
      steps: [
        { type: 'warmup', durationMinutes: 8 },
        { type: 'recovery', durationMinutes: 25, target },
        { type: 'cooldown', durationMinutes: 5 },
      ],
    });
    expect(result.steps.map((step) => step.kind)).toEqual(['warmup', 'steady', 'cooldown']);
  });

  it('falls back to one block when a workout has no steps', () => {
    const result = builder.build({ ...base, type: 'tempo', steps: [] });
    expect(result.steps).toEqual([
      expect.objectContaining({ kind: 'work', durationSec: 3000, targetPace: { minSecPerKm: 280, maxSecPerKm: 290 } }),
    ]);
  });

  it('runs a race by distance without a pace target', () => {
    const result = builder.build({ ...base, type: 'race', steps: [{ type: 'race', durationMinutes: 45, target }] });
    expect(result.steps).toEqual([
      expect.objectContaining({ kind: 'steady', distanceM: 10000, durationSec: null, targetPace: null }),
    ]);
    expect(result.totalDistanceM).toBe(10000);
  });

  describe('a workout added with one goal', () => {
    const own = { id: 'w-2', type: 'easy' as const, steps: [] };

    it('runs a duration goal as one timed step', () => {
      const result = builder.build({ ...own, durationMinutes: 50, distanceKm: 0, target: { goal: 'duration' } });
      expect(result.steps).toEqual([
        expect.objectContaining({ kind: 'steady', durationSec: 3000, distanceM: null, targetPace: null }),
      ]);
    });

    it('runs a distance goal with a time limit inside the pace corridor', () => {
      const result = builder.build({
        ...own,
        durationMinutes: 50,
        distanceKm: 8,
        target: { goal: 'distance', timeLimitMin: 50 },
      });
      expect(result.steps).toEqual([
        expect.objectContaining({
          durationSec: null,
          distanceM: 8000,
          targetPace: { minSecPerKm: 370, maxSecPerKm: 380 },
        }),
      ]);
      expect(result.totalDistanceM).toBe(8000);
    });

    it('has no steps without a goal', () => {
      const result = builder.build({ ...own, durationMinutes: 0, distanceKm: 0, target: { goal: 'none' } });
      expect(result.steps).toEqual([]);
    });
  });
});
