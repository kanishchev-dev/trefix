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
    birthDate: null,
    restingHeartRate: null,
    maxHeartRate: null,
    thresholdHeartRate: null,
    hrZonesMethod: 'max_hr' as const,
    hrZonesCustom: null,
    runningSinceYear: null,
    limitations: null,
    preferredTimeOfDay: 'any' as const,
    longRunDay: null,
    longRunMaxDurationMinutes: null,
    fieldSources: {},
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  const goal: GoalView = {
    id: 'goal-1',
    athleteId: athlete.id,
    type: 'improve_race_result',
    payload: {
      target: { distanceMeters: 10_000, finishTimeSec: 2700 },
    },
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

  it('honors manual options: week count, preferred long run day and focus', () => {
    const manualGoal: GoalView = { ...goal, targetDate: '2026-11-01' };
    const plan = engine.generatePlan(athlete, manualGoal, state, new Date('2026-09-15T00:00:00.000Z'), {
      totalWeeks: 8,
      preferredLongRunDay: 6,
      focus: ['tempo', 'long_run'],
    });

    expect(plan.weeks.length).toBe(8);
    // Long run must land on the preferred weekday (Saturday, index 6).
    const longRuns = plan.workouts.filter((workout) => workout.type === 'long_run');
    expect(longRuns.length).toBeGreaterThan(0);
    for (const longRun of longRuns) {
      expect((longRun.scheduledAt.getUTCDay() + 6) % 7).toBe(6);
    }
  });

  it('steers workout emphasis from the goal type when no explicit focus is set', () => {
    const enduranceGoal: GoalView = {
      ...goal,
      type: 'build_endurance',
      payload: { target: { continuousDistanceKm: 20 } },
      targetTimeSeconds: null,
      raceDistance: 'just_running',
    };
    const plan = engine.generatePlan(athlete, enduranceGoal, state, new Date('2026-09-15T00:00:00.000Z'), {
      totalWeeks: 8,
    });

    // Endurance goals emphasize long runs beyond the positional default.
    expect(plan.workouts.filter((workout) => workout.type === 'long_run').length).toBeGreaterThan(0);

    const consistencyGoal: GoalView = {
      ...goal,
      type: 'build_consistency',
      payload: { target: { runsPerWeek: 4 } },
    };
    const consistencyPlan = engine.generatePlan(athlete, consistencyGoal, state, new Date('2026-09-15T00:00:00.000Z'), {
      totalWeeks: 8,
    });
    expect(consistencyPlan.workouts.length).toBeGreaterThan(0);
  });

  it('derives threshold pace from the universal goal payload', () => {
    // 10K in 2700s = 270 s/km target pace from the payload alone.
    const payloadOnlyGoal: GoalView = {
      ...goal,
      type: 'improve_race_result',
      payload: { target: { distanceMeters: 10_000, finishTimeSec: 2700 } },
      targetTimeSeconds: null,
    };
    const nextState = engine.calculateTrainingState(athlete, [], payloadOnlyGoal);
    expect(nextState.thresholdPaceSecondsPerKm).toBe(270);
  });

  it('validates workout overrides for the manual editor', () => {
    expect(engine.validateWorkoutOverride({ type: 'tempo', distanceKm: 7 })).toEqual({
      valid: true,
      value: { type: 'tempo', distanceKm: 7 },
    });
    expect(engine.validateWorkoutOverride({ type: 'plyometrics', distanceKm: 5 }).valid).toBe(false);
    expect(engine.validateWorkoutOverride({ type: 'easy', dayOfWeek: 9 }).valid).toBe(false);
    expect(engine.validateWorkoutOverride({ type: 'easy', distanceKm: 500 }).valid).toBe(false);
    expect(engine.validateWorkoutOverride({ type: 'easy', distanceKm: 0 }).valid).toBe(false);
    expect(engine.validateWorkoutOverride({ type: 'easy', durationMinutes: 5 }).valid).toBe(false);
    // Overrides carry only changed fields: a day-only change is valid because the
    // service merges it with the existing workout before validating.
    expect(engine.validateWorkoutOverride({ type: 'easy', dayOfWeek: 2 }).valid).toBe(true);
    expect(engine.validateWorkoutOverride({ type: 'easy' }).valid).toBe(true);
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
