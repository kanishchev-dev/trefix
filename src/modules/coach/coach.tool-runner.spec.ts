import { Test, TestingModule } from '@nestjs/testing';

import { TrainingService } from '@/modules/training/training.service';

import { CoachToolRunner } from './coach.tool-runner';

describe('CoachToolRunner', () => {
  let runner: CoachToolRunner;

  const trainingService = {
    getAthlete: jest.fn(),
    getAthleteState: jest.fn(),
    getLatestGoalForAthlete: jest.fn(),
    getLatestPlanForAthlete: jest.fn(),
    getWorkout: jest.fn(),
    listRecentWorkoutsForAthlete: jest.fn(),
    adaptPlan: jest.fn(),
    analyzeWorkout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    trainingService.getAthlete.mockResolvedValue({ id: 'athlete-1' });
    trainingService.getAthleteState.mockResolvedValue({ id: 'state-1', confidence: 0.86 });
    trainingService.getLatestGoalForAthlete.mockResolvedValue({ id: 'goal-1' });
    trainingService.getLatestPlanForAthlete.mockResolvedValue({ id: 'plan-1' });
    trainingService.getWorkout.mockResolvedValue({ id: 'workout-1' });
    trainingService.listRecentWorkoutsForAthlete.mockResolvedValue([{ id: 'workout-1' }]);
    trainingService.adaptPlan.mockResolvedValue({ id: 'adaptation-1' });
    trainingService.analyzeWorkout.mockResolvedValue({ id: 'analysis-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachToolRunner,
        {
          provide: TrainingService,
          useValue: trainingService,
        },
      ],
    }).compile();

    runner = module.get(CoachToolRunner);
  });

  it('runs supported tools and returns structured results', async () => {
    const results = await runner.runTools('user-1', 'athlete-1', [
      { name: 'getAthleteState', arguments: {} },
      { name: 'getCurrentPlan', arguments: {} },
      { name: 'getRecentWorkouts', arguments: { limit: 5 } },
      { name: 'getGoal', arguments: {} },
      { name: 'getWorkout', arguments: { workoutId: 'workout-1' } },
      {
        name: 'analyzeWorkout',
        arguments: {
          workoutId: 'workout-1',
          actualDurationMinutes: 45,
          actualDistanceKm: 8.2,
          rpe: 6,
        },
      },
      {
        name: 'moveWorkout',
        arguments: {
          planId: 'plan-1',
          workoutId: 'workout-1',
          reason: 'stable',
        },
      },
      {
        name: 'replaceWorkout',
        arguments: {
          planId: 'plan-1',
          workoutId: 'workout-1',
          reason: 'fatigue',
        },
      },
      {
        name: 'adjustPlan',
        arguments: {
          planId: 'plan-1',
          workoutId: 'workout-1',
          forcedAction: 'KEEP',
          reason: 'stable',
        },
      },
      { name: 'unsupported' as never, arguments: {} },
    ]);

    expect(trainingService.adaptPlan).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        planId: 'plan-1',
        workoutId: 'workout-1',
        forcedAction: 'KEEP',
        reason: 'stable',
      }),
    );
    expect(trainingService.analyzeWorkout).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        workoutId: 'workout-1',
        actualDurationMinutes: 45,
        actualDistanceKm: 8.2,
        rpe: 6,
      }),
    );
    expect(results).toEqual([
      {
        name: 'getAthleteState',
        input: {},
        output: {
          state: { id: 'state-1', confidence: 0.86 },
        },
      },
      {
        name: 'getCurrentPlan',
        input: {},
        output: { plan: { id: 'plan-1' } },
      },
      {
        name: 'getRecentWorkouts',
        input: { limit: 5 },
        output: { recentWorkouts: [{ id: 'workout-1' }] },
      },
      {
        name: 'getGoal',
        input: {},
        output: { goal: { id: 'goal-1' } },
      },
      {
        name: 'getWorkout',
        input: { workoutId: 'workout-1' },
        output: { workout: { id: 'workout-1' } },
      },
      {
        name: 'analyzeWorkout',
        input: {
          workoutId: 'workout-1',
          actualDurationMinutes: 45,
          actualDistanceKm: 8.2,
          rpe: 6,
        },
        output: { analysis: { id: 'analysis-1' } },
      },
      {
        name: 'moveWorkout',
        input: {
          planId: 'plan-1',
          workoutId: 'workout-1',
          reason: 'stable',
        },
        output: { athleteId: 'athlete-1', adaptation: { id: 'adaptation-1' } },
      },
      {
        name: 'replaceWorkout',
        input: {
          planId: 'plan-1',
          workoutId: 'workout-1',
          reason: 'fatigue',
        },
        output: { athleteId: 'athlete-1', adaptation: { id: 'adaptation-1' } },
      },
      {
        name: 'adjustPlan',
        input: {
          planId: 'plan-1',
          workoutId: 'workout-1',
          forcedAction: 'KEEP',
          reason: 'stable',
        },
        output: { athleteId: 'athlete-1', adaptation: { id: 'adaptation-1' } },
      },
      {
        name: 'unsupported',
        input: {},
        output: {
          error: 'unsupported_tool',
          message: 'Tool "unsupported" is not supported.',
        },
      },
    ]);
  });
});
