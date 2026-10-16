import type { WorkoutView } from '../interfaces/training-views.interface';
import { analyzeWorkout } from './training-load';

const planned = (durationMinutes: number, distanceKm: number): WorkoutView =>
  ({
    id: 'w-1',
    athleteId: 'a-1',
    type: 'easy',
    status: 'planned',
    durationMinutes,
    distanceKm,
    target: {},
    steps: [],
  }) as unknown as WorkoutView;

describe('analyzeWorkout with a single goal', () => {
  it('counts completion by the distance alone when no duration was planned', () => {
    const result = analyzeWorkout({ plannedWorkout: planned(0, 8), actualDurationMinutes: 50, actualDistanceKm: 8 });
    expect(result.analysis.completion).toBeCloseTo(1);
    expect(result.analysis.load).toBeGreaterThan(0);
    expect(result.analysis.expectedLoad).toBeGreaterThan(0);
  });

  it('counts completion by the time alone when no distance was planned', () => {
    const result = analyzeWorkout({ plannedWorkout: planned(50, 0), actualDurationMinutes: 25, actualDistanceKm: 4 });
    expect(result.analysis.completion).toBeCloseTo(0.5);
  });

  it('treats a workout without a goal as done and loads it by the time run', () => {
    const result = analyzeWorkout({ plannedWorkout: planned(0, 0), actualDurationMinutes: 40, actualDistanceKm: 7 });
    expect(result.analysis.completion).toBe(1);
    expect(result.analysis.load).toBeGreaterThan(0);
  });
});
