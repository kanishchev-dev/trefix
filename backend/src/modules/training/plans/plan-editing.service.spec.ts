import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Transaction } from 'sequelize';

import { AdaptationEvent } from '../entities/adaptation-event.entity';
import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { TrainingEngine } from '../training.engine';
import { PlanChangeCalculator } from './plan-change-calculator';
import { PlanEditingService } from './plan-editing.service';
import { PlanLifecycleService } from './plan-lifecycle.service';
import { PlanStatsService } from './plan-stats.service';

const draftWeeks = (): Array<Record<string, unknown>> => [
  {
    weekNumber: 1,
    phase: 'base',
    workouts: [
      {
        key: 'w1-1',
        dayOfWeek: 1,
        orderInWeek: 1,
        type: 'easy',
        phase: 'base',
        durationMinutes: 40,
        distanceKm: 6,
        target: { paceMinSecondsPerKm: 330, paceMaxSecondsPerKm: 360, zone: 'Z2' },
        steps: [],
      },
    ],
  },
];

const makePlan = (overrides: Partial<Record<string, unknown>> = {}): TrainingPlan =>
  ({
    id: 'plan-1',
    athleteId: 'athlete-1',
    goalId: 'goal-1',
    name: 'Plan',
    notes: null,
    status: 'draft',
    startDate: null,
    endDate: null,
    version: 3,
    weeks: draftWeeks(),
    metricsSnapshot: null,
    config: { goal: {}, schedule: {}, structure: {} },
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as TrainingPlan;

const makeWorkout = (overrides: Partial<Record<string, unknown>> = {}): Workout =>
  ({
    id: 'workout-1',
    planId: 'plan-1',
    weekNumber: 1,
    orderInWeek: 1,
    type: 'easy',
    phase: 'base',
    status: 'planned',
    scheduledAt: new Date('2027-01-06T00:00:00Z'),
    durationMinutes: 40,
    distanceKm: 6,
    target: {},
    steps: [],
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as Workout;

describe('PlanEditingService', () => {
  let service: PlanEditingService;
  let planModel: { findByPk: jest.Mock };
  let workoutModel: { findAll: jest.Mock; bulkCreate: jest.Mock };
  let adaptationEventModel: { create: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    afterCommit: (callback: () => void): void => callback(),
  } as unknown as Transaction;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-05T09:00:00Z'));
    planModel = { findByPk: jest.fn() };
    workoutModel = { findAll: jest.fn().mockResolvedValue([]), bulkCreate: jest.fn() };
    adaptationEventModel = { create: jest.fn().mockResolvedValue({}) };
    eventEmitter = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanEditingService,
        PlanChangeCalculator,
        PlanStatsService,
        TrainingEngine,
        {
          provide: getModelToken(Athlete),
          useValue: {
            findByPk: jest.fn().mockResolvedValue({ id: 'athlete-1', userId: 'user-1' }),
            findOne: jest.fn(),
          },
        },
        { provide: getModelToken(AthleteGoal), useValue: { update: jest.fn() } },
        { provide: getModelToken(TrainingPlan), useValue: planModel },
        { provide: getModelToken(Workout), useValue: workoutModel },
        { provide: getModelToken(AdaptationEvent), useValue: adaptationEventModel },
        {
          provide: PlanLifecycleService,
          useValue: {
            inTransaction: jest.fn(async (work: (t: Transaction) => Promise<unknown>) => work(transaction)),
            lockAthlete: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(PlanEditingService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides foreign plans behind the same not-found error', async () => {
    planModel.findByPk.mockResolvedValue(makePlan());
    await expect(service.loadOwnedPlan('plan-1', 'someone-else')).rejects.toMatchObject({
      code: 'TRAINING_PLAN_NOT_FOUND',
    });
  });

  describe('meta', () => {
    it('renames a plan with the matching version', async () => {
      const plan = makePlan();
      planModel.findByPk.mockResolvedValue(plan);

      await service.updateMeta('plan-1', 'user-1', { name: '  Marathon 2027  ', expectedVersion: 3 });
      expect(plan.name).toBe('Marathon 2027');
    });

    it('rejects a stale version and an empty name', async () => {
      planModel.findByPk.mockResolvedValue(makePlan());
      await expect(service.updateMeta('plan-1', 'user-1', { name: 'X', expectedVersion: 1 })).rejects.toMatchObject({
        code: 'PLAN_VERSION_CONFLICT',
      });
      await expect(service.updateMeta('plan-1', 'user-1', { name: '   ', expectedVersion: 3 })).rejects.toMatchObject({
        code: 'PLAN_CHANGE_INVALID',
      });
    });
  });

  it('refuses to delete the active plan', async () => {
    planModel.findByPk.mockResolvedValue(makePlan({ status: 'active' }));
    await expect(service.deletePlan('plan-1', 'user-1')).rejects.toMatchObject({ code: 'PLAN_ACTIVE_CANNOT_DELETE' });
  });

  describe('draft structure', () => {
    it('edits a draft workout by key and rebuilds its targets', async () => {
      const plan = makePlan();
      planModel.findByPk.mockResolvedValue(plan);

      await service.updateDraftStructure('plan-1', 'user-1', {
        expectedVersion: 3,
        weekOverrides: [{ weekNumber: 1, workoutOverrides: [{ key: 'w1-1', type: 'tempo' }] }],
      });

      const workout = (plan.weeks[0].workouts as Array<Record<string, unknown>>)[0];
      expect(workout.type).toBe('tempo');
      expect((workout.target as Record<string, unknown>).zone).toBe('Z3');
    });

    it('rejects unknown keys', async () => {
      planModel.findByPk.mockResolvedValue(makePlan());
      await expect(
        service.updateDraftStructure('plan-1', 'user-1', {
          expectedVersion: 3,
          weekOverrides: [{ weekNumber: 1, removedWorkoutKeys: ['w1-7'] }],
        }),
      ).rejects.toMatchObject({ code: 'PLAN_CHANGE_INVALID' });
    });
  });

  describe('active plan changes', () => {
    const active = (): TrainingPlan =>
      makePlan({
        status: 'active',
        startDate: '2027-01-04',
        endDate: '2027-01-17',
        weeks: [
          { weekNumber: 1, phase: 'base', workoutIds: ['workout-1'] },
          { weekNumber: 2, phase: 'base', workoutIds: [] },
        ],
      });

    it('applies the change in one transaction with a user_edit event and fresh week ids', async () => {
      const plan = active();
      const workout = makeWorkout();
      planModel.findByPk.mockResolvedValue(plan);
      workoutModel.findAll
        .mockResolvedValueOnce([workout])
        .mockResolvedValueOnce([{ ...workout, weekNumber: 2, id: 'workout-1', status: 'planned' }]);

      await service.applyChanges('plan-1', 'user-1', {
        kind: 'workouts',
        expectedVersion: 3,
        timezone: 'UTC',
        operations: [{ op: 'move', workoutId: 'workout-1', date: '2027-01-12' }],
      });

      expect(workout.save).toHaveBeenCalledWith({ transaction });
      expect(workout.weekNumber).toBe(2);
      expect(adaptationEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'user_edit', planId: 'plan-1' }),
        { transaction },
      );
      expect(plan.weeks[1].workoutIds).toEqual(['workout-1']);
      expect(plan.weeks[0].workoutIds).toEqual([]);
      expect(plan.save).toHaveBeenCalledWith({ transaction });
    });

    it('rejects changes of a plan that is not active', async () => {
      planModel.findByPk.mockResolvedValue(makePlan());
      await expect(
        service.previewChanges('plan-1', 'user-1', { kind: 'workouts', expectedVersion: 3, operations: [] }),
      ).rejects.toMatchObject({ code: 'PLAN_INVALID_STATUS' });
    });

    it('rejects a stale version before computing anything', async () => {
      planModel.findByPk.mockResolvedValue(active());
      await expect(
        service.previewChanges('plan-1', 'user-1', { kind: 'workouts', expectedVersion: 1, operations: [] }),
      ).rejects.toMatchObject({ code: 'PLAN_VERSION_CONFLICT' });
      expect(workoutModel.findAll).not.toHaveBeenCalled();
    });
  });
});
