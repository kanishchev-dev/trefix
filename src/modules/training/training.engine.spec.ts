import { AthleteView, GoalView, WorkoutView } from './interfaces/training-views.interface';
import { TrainingEngine, TrainingStateComputation } from './training.engine';

describe('TrainingEngine', () => {
  const engine = new TrainingEngine();

  const athlete: AthleteView = {
    id: 'athlete-1',
    userId: 'user-1',
    age: 31,
    sex: 'male',
    heightCm: 178,
    weightKg: 74,
    experienceLevel: 'intermediate',
    weeklyMileageKm: 38,
    sessionsPerWeek: 4,
    recentRaceResults: [],
    preferredTrainingDays: ['tuesday', 'thursday', 'saturday'],
    availableTrainingDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
    preferredWorkoutDurationMinutes: 50,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  const goal: GoalView = {
    id: 'goal-1',
    athleteId: athlete.id,
    raceDistance: '10k',
    targetTimeSeconds: 2700,
    targetDate: '2026-11-01',
    priority: 5,
    status: 'active',
    notes: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  const state: TrainingStateComputation = {
    fitness: 42,
    fatigue: 28,
    form: 14,
    weeklyLoad: 28,
    acuteLoad: 28,
    chronicLoad: 42,
    recoveryScore: 68,
    thresholdPaceSecondsPerKm: 270,
    thresholdHeartRate: 168,
    vo2max: 56,
    confidence: 0.86,
    source: 'deterministic_v1',
  };

  it('generates a structured plan with workouts for each training week', () => {
    const plan = engine.generatePlan(athlete, goal, state, new Date('2026-09-15T00:00:00.000Z'));

    expect(plan.trainingFrequency).toBe(4);
    expect(plan.weeks.length).toBeGreaterThanOrEqual(6);
    expect(plan.workouts.length).toBeGreaterThan(0);
    expect(plan.workouts.some((workout) => workout.type === 'long_run')).toBe(true);
  });

  it('analyzes a workout deterministically', () => {
    const plannedWorkout: WorkoutView = {
      id: 'workout-1',
      athleteId: athlete.id,
      goalId: goal.id,
      planId: 'plan-1',
      weekNumber: 1,
      scheduledAt: new Date('2026-09-16T00:00:00.000Z'),
      type: 'interval',
      phase: 'build',
      status: 'planned',
      orderInWeek: 2,
      durationMinutes: 55,
      distanceKm: 10,
      target: {
        paceMinSecondsPerKm: 250,
        paceMaxSecondsPerKm: 260,
        zone: 'Z5',
      },
      steps: [],
      actual: null,
      analysis: null,
      completedAt: null,
      createdAt: new Date('2026-09-15T00:00:00.000Z'),
      updatedAt: new Date('2026-09-15T00:00:00.000Z'),
    };

    const result = engine.analyzeWorkout({
      plannedWorkout,
      actualDurationMinutes: 46,
      actualDistanceKm: 8,
      actualAveragePaceSecondsPerKm: 280,
      rpe: 7,
    });

    expect(result.analysis.completion).toBeLessThan(1);
    expect(result.analysis.load).toBeGreaterThan(0);
    expect(result.analysis.fatigueImpact).toBe('moderate');
  });

  it('adapts a plan after poor performance', () => {
    const plannedWorkout: WorkoutView = {
      id: 'workout-2',
      athleteId: athlete.id,
      goalId: goal.id,
      planId: 'plan-2',
      weekNumber: 2,
      scheduledAt: new Date('2026-09-18T00:00:00.000Z'),
      type: 'threshold',
      phase: 'build',
      status: 'planned',
      orderInWeek: 2,
      durationMinutes: 50,
      distanceKm: 9,
      target: {
        paceMinSecondsPerKm: 255,
        paceMaxSecondsPerKm: 265,
        zone: 'Z4',
      },
      steps: [],
      actual: null,
      analysis: null,
      completedAt: null,
      createdAt: new Date('2026-09-15T00:00:00.000Z'),
      updatedAt: new Date('2026-09-15T00:00:00.000Z'),
    };

    const analysis = engine.analyzeWorkout({
      plannedWorkout,
      actualDurationMinutes: 30,
      actualDistanceKm: 4,
      actualAveragePaceSecondsPerKm: 360,
      rpe: 8,
    }).analysis;

    const adaptation = engine.adaptPlan(
      [{ weekNumber: 1, phase: 'build', weeklyLoadTarget: 35, workoutIds: [] }],
      [
        {
          ...plannedWorkout,
          id: 'upcoming-1',
          status: 'planned',
        },
      ],
      state,
      analysis,
    );

    expect(adaptation.action).toBe('REDUCE_INTENSITY');
    expect(adaptation.changes.length).toBeGreaterThan(0);
  });
});
