import { EventEmitter2 } from '@nestjs/event-emitter';
import { Op } from 'sequelize';

import type { AdaptationsService } from '../adaptations/adaptations.service';
import { AthleteStateService } from '../athletes/athlete-state.service';
import type { Athlete } from '../entities/athlete.entity';
import type { AthleteGoal } from '../entities/athlete-goal.entity';
import type { AthleteState } from '../entities/athlete-state.entity';
import type { TrainingLoad } from '../entities/training-load.entity';
import type { TrainingPlan } from '../entities/training-plan.entity';
import type { Workout } from '../entities/workout.entity';
import type { ImportedWorkoutFacts } from '../interfaces/imported-workout.interface';
import type { TrainingEngine } from '../training.engine';
import { TrainingLookupService } from '../training-lookup.service';
import { WorkoutImportService } from './workout-import.service';

const facts = (overrides: Partial<ImportedWorkoutFacts> = {}): ImportedWorkoutFacts => ({
  sourceProvider: 'apple_health',
  sourceActivityId: 'hk-1',
  startedAt: new Date('2026-10-08T05:00:00Z'),
  endedAt: new Date('2026-10-08T05:50:00Z'),
  durationMinutes: 50,
  distanceKm: 10,
  averagePaceSecondsPerKm: 300,
  averageHeartRate: 148,
  maxHeartRate: 171,
  cadence: 172,
  calories: 700,
  elevationGainMeters: 60,
  indoor: false,
  sport: 'run',
  ...overrides,
});

type MockWorkout = Workout & { save: jest.Mock; destroy: jest.Mock };

const makeWorkout = (overrides: Record<string, unknown> = {}): MockWorkout =>
  ({
    id: 'w-1',
    athleteId: 'athlete-1',
    planId: null,
    scheduledAt: new Date('2026-10-08T00:00:00Z'),
    type: 'easy',
    phase: 'adhoc',
    status: 'completed',
    orderInWeek: 1,
    weekNumber: 1,
    durationMinutes: 45,
    distanceKm: 9,
    target: {},
    steps: [],
    actual: { actualDistanceKm: 9, rpe: 6, notes: 'tired legs' },
    analysis: null,
    completedAt: new Date('2026-10-08T06:00:00Z'),
    sourceProvider: 'manual',
    sourceActivityId: null,
    gearId: 'gear-1',
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as MockWorkout;

describe('WorkoutImportService', () => {
  const athlete = { id: 'athlete-1', userId: 'user-1' } as Athlete;
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, afterCommit: (callback: () => void): void => callback() };
  let workoutModel: { findByPk: jest.Mock; findAll: jest.Mock; create: jest.Mock; sequelize: unknown };
  let trainingLoadModel: { findOne: jest.Mock; create: jest.Mock; destroy: jest.Mock };
  let trainingEngine: { analyzeWorkout: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let adaptations: { decideAndApply: jest.Mock };
  let service: WorkoutImportService;
  let recalculate: jest.SpyInstance;

  beforeEach(() => {
    workoutModel = {
      findByPk: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      sequelize: { transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(transaction)) },
    };
    trainingLoadModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (values) => values),
      destroy: jest.fn(),
    };
    trainingEngine = {
      analyzeWorkout: jest.fn().mockReturnValue({
        analysis: { completion: 1, load: 55 },
        trainingLoad: 55,
        intensityFactor: 0.7,
      }),
    };
    eventEmitter = { emit: jest.fn() };
    adaptations = { decideAndApply: jest.fn().mockResolvedValue({}) };
    const athleteModel = { findByPk: jest.fn().mockResolvedValue(athlete) };

    const lookup = new TrainingLookupService(
      athleteModel as unknown as typeof Athlete,
      {} as typeof AthleteGoal,
      {} as typeof TrainingPlan,
      workoutModel as unknown as typeof Workout,
    );
    const athleteState = new AthleteStateService(
      {} as typeof AthleteState,
      trainingLoadModel as unknown as typeof TrainingLoad,
      lookup,
      trainingEngine as unknown as TrainingEngine,
      eventEmitter as unknown as EventEmitter2,
    );
    recalculate = jest.spyOn(athleteState, 'recalculate').mockResolvedValue({} as never);

    service = new WorkoutImportService(
      workoutModel as unknown as typeof Workout,
      lookup,
      athleteState,
      adaptations as unknown as AdaptationsService,
      trainingEngine as unknown as TrainingEngine,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('completeWorkoutFromImport', () => {
    it('completes a planned workout with the device facts and adapts the plan', async () => {
      const workout = makeWorkout({ status: 'planned', planId: 'plan-1', actual: null, sourceProvider: null });
      workoutModel.findByPk.mockResolvedValue(workout);

      await service.completeWorkoutFromImport('w-1', facts());

      expect(workout.status).toBe('completed');
      expect(workout.sourceProvider).toBe('apple_health');
      expect(workout.sourceActivityId).toBe('hk-1');
      expect(workout.completedAt).toEqual(facts().endedAt);
      expect(workout.actual).toMatchObject({ actualDistanceKm: 10, actualAverageHeartRate: 148, cadence: 172 });
      expect(trainingLoadModel.create).toHaveBeenCalledWith(expect.objectContaining({ workoutId: 'w-1', load: 55 }), {
        transaction,
      });
      expect(recalculate).toHaveBeenCalledWith('athlete-1', transaction);
      expect(adaptations.decideAndApply).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('training.workout.completed', expect.any(Object));
    });

    it('rejects workouts that are not planned', async () => {
      workoutModel.findByPk.mockResolvedValue(makeWorkout({ status: 'skipped' }));
      await expect(service.completeWorkoutFromImport('w-1', facts())).rejects.toMatchObject({
        code: 'WORKOUT_NOT_PLANNED',
      });
    });
  });

  describe('createImportedWorkout', () => {
    beforeEach(() => {
      workoutModel.create.mockImplementation(async (values) => makeWorkout({ ...values, id: 'w-new' }));
    });

    it('creates a completed ad-hoc workout at the start time', async () => {
      await service.createImportedWorkout('athlete-1', facts());

      expect(workoutModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          type: 'easy',
          scheduledAt: facts().startedAt,
          completedAt: facts().endedAt,
          sourceProvider: 'apple_health',
          sourceActivityId: 'hk-1',
          target: { source: 'apple_health' },
        }),
        { transaction },
      );
      expect(adaptations.decideAndApply).not.toHaveBeenCalled();
      const where = workoutModel.findAll.mock.calls[0][0].where;
      expect(where.scheduledAt[Op.lt]).toEqual(facts().startedAt);
    });

    it('marks a clearly longer run as long_run', async () => {
      workoutModel.findAll.mockResolvedValue([
        { distanceKm: 8, actual: { actualDistanceKm: 8 } },
        { distanceKm: 12, actual: null },
      ]);
      await service.createImportedWorkout('athlete-1', facts({ distanceKm: 16 }));
      expect(workoutModel.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'long_run' }), { transaction });
    });

    it('stores a long hike as a hike, out of running records', async () => {
      await service.createImportedWorkout('athlete-1', facts({ distanceKm: 20, sport: 'hike' }));
      expect(workoutModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'easy', sport: 'hike', excludeFromRecords: true }),
        { transaction },
      );
    });

    it('uses the recent average when it exceeds the 16 km floor', async () => {
      workoutModel.findAll.mockResolvedValue([{ distanceKm: 14, actual: { actualDistanceKm: 14 } }]);
      await service.createImportedWorkout('athlete-1', facts({ distanceKm: 18 }));
      expect(workoutModel.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'easy' }), { transaction });
    });
  });

  describe('applyImportedFacts', () => {
    it('replaces facts but keeps RPE and notes, and updates the existing load', async () => {
      const workout = makeWorkout();
      const load = { load: 20, save: jest.fn().mockImplementation(async () => load) };
      workoutModel.findByPk.mockResolvedValue(workout);
      trainingLoadModel.findOne.mockResolvedValue(load);

      await service.applyImportedFacts('w-1', facts());

      expect(workout.actual).toMatchObject({ actualDistanceKm: 10, rpe: 6, notes: 'tired legs' });
      expect(workout.sourceProvider).toBe('apple_health');
      expect(workout.scheduledAt).toEqual(facts().startedAt);
      expect(load.load).toBe(55);
      expect(load.save).toHaveBeenCalled();
      expect(trainingLoadModel.create).not.toHaveBeenCalled();
    });

    it('keeps the plan date of a plan workout', async () => {
      const scheduledAt = new Date('2026-10-08T06:30:00Z');
      const workout = makeWorkout({ planId: 'plan-1', scheduledAt });
      workoutModel.findByPk.mockResolvedValue(workout);

      await service.applyImportedFacts('w-1', facts());

      expect(workout.scheduledAt).toBe(scheduledAt);
    });
  });

  describe('revertImportedWorkout', () => {
    it('returns a plan workout to planned', async () => {
      const workout = makeWorkout({ planId: 'plan-1', sourceProvider: 'strava', sourceActivityId: 's-1' });
      workoutModel.findByPk.mockResolvedValue(workout);

      expect(await service.revertImportedWorkout('w-1')).toBe('replanned');
      expect(workout).toMatchObject({
        status: 'planned',
        actual: null,
        analysis: null,
        completedAt: null,
        gearId: null,
        sourceProvider: null,
        sourceActivityId: null,
      });
      expect(workout.destroy).not.toHaveBeenCalled();
      expect(trainingLoadModel.destroy).toHaveBeenCalledWith({ where: { workoutId: 'w-1' }, transaction });
      expect(recalculate).toHaveBeenCalledWith('athlete-1', transaction);
    });

    it('deletes an ad-hoc workout and frees its source key', async () => {
      const workout = makeWorkout({ sourceProvider: 'strava', sourceActivityId: 's-1' });
      workoutModel.findByPk.mockResolvedValue(workout);

      expect(await service.revertImportedWorkout('w-1')).toBe('deleted');
      expect(workout.sourceActivityId).toBeNull();
      expect(workout.destroy).toHaveBeenCalled();
    });
  });
});
