import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Transaction } from 'sequelize';

import { Athlete } from '../entities/athlete.entity';
import { AthleteGoal } from '../entities/athlete-goal.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { TrainingEngine } from '../training.engine';
import { AthleteMetricsService } from './athlete-metrics.service';
import { CreatePlanInput, PlanLifecycleService } from './plan-lifecycle.service';
import { PlanStatsService } from './plan-stats.service';

const relativeWeeks = (): Array<Record<string, unknown>> => [
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
        target: {},
        steps: [],
      },
    ],
  },
  {
    weekNumber: 2,
    phase: 'build',
    workouts: [
      {
        key: 'w2-1',
        dayOfWeek: 3,
        orderInWeek: 1,
        type: 'tempo',
        phase: 'build',
        durationMinutes: 45,
        distanceKm: 8,
        target: {},
        steps: [],
      },
    ],
  },
];

const makePlan = (overrides: Partial<Record<string, unknown>> = {}): TrainingPlan =>
  ({
    id: 'plan-1',
    athleteId: 'athlete-1',
    goalId: null,
    name: 'Draft plan',
    status: 'draft',
    creationSource: 'manual',
    startDate: null,
    endDate: null,
    version: 0,
    trainingFrequency: 1,
    weeks: relativeWeeks(),
    metricsSnapshot: null,
    updatedAt: new Date('2027-03-01T00:00:00Z'),
    config: { goal: { type: 'prepare_for_race', target: { distanceMeters: 42195 } }, schedule: {}, structure: {} },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as TrainingPlan;

describe('PlanLifecycleService', () => {
  let service: PlanLifecycleService;
  let planModel: Record<string, jest.Mock | object>;
  let workoutModel: Record<string, jest.Mock | object>;
  let goalModel: { create: jest.Mock; update: jest.Mock; findByPk: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let afterCommit: Array<() => void>;

  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    afterCommit: (callback: () => void): void => {
      afterCommit.push(callback);
    },
  } as unknown as Transaction;
  const commit = (): void => afterCommit.forEach((callback) => callback());

  beforeEach(async () => {
    // 2027-03-03 is a Wednesday.
    jest.useFakeTimers().setSystemTime(new Date('2027-03-03T10:00:00Z'));
    afterCommit = [];
    planModel = {
      findByPk: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(async (values: Record<string, unknown>) => makePlan(values)),
      count: jest.fn().mockResolvedValue(0),
      sequelize: { transaction: jest.fn(async (work: (t: Transaction) => Promise<unknown>) => work(transaction)) },
    };
    workoutModel = {
      bulkCreate: jest.fn(async (rows: Array<Record<string, unknown>>) =>
        rows.map((row, index) => ({ ...row, id: `w-${index}` })),
      ),
      update: jest.fn().mockResolvedValue([3]),
      count: jest.fn().mockResolvedValue(5),
      findAll: jest.fn().mockResolvedValue([]),
      destroy: jest.fn(),
      sequelize: {
        query: jest
          .fn()
          .mockResolvedValue([{ plan_id: 'plan-active', total: 4, completed: 3, planned: 1, distance: 30 }]),
      },
    };
    goalModel = {
      create: jest.fn(async (values: Record<string, unknown>) => ({ id: 'goal-new', ...values })),
      update: jest.fn().mockResolvedValue([1]),
      findByPk: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanLifecycleService,
        PlanStatsService,
        TrainingEngine,
        { provide: getModelToken(Athlete), useValue: { findByPk: jest.fn().mockResolvedValue({ id: 'athlete-1' }) } },
        { provide: getModelToken(AthleteGoal), useValue: goalModel },
        { provide: getModelToken(TrainingPlan), useValue: planModel },
        { provide: getModelToken(Workout), useValue: workoutModel },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(100) } },
        {
          provide: AthleteMetricsService,
          useValue: {
            currentMetrics: jest.fn().mockResolvedValue({}),
            toSnapshotMetrics: jest.fn().mockReturnValue({ capturedAt: '2027-03-03T10:00:00Z' }),
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(PlanLifecycleService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const activePlan = (): TrainingPlan =>
    makePlan({
      id: 'plan-active',
      name: 'Trail 50K',
      status: 'active',
      startDate: '2027-02-15',
      endDate: '2027-04-25',
      weeks: new Array(10).fill({}),
      goalId: 'goal-old',
    });

  describe('startPlan', () => {
    it('materializes the draft from the start date and creates the goal', async () => {
      const draft = makePlan();
      (planModel.findByPk as jest.Mock).mockResolvedValue(draft);

      await service.startPlan('plan-1', { startDate: '2027-03-08', replaceActive: false, timezone: 'UTC' });
      commit();

      expect(draft.status).toBe('active');
      expect(draft.startDate).toBe('2027-03-08');
      expect(draft.endDate).toBe('2027-03-21');
      const rows = (workoutModel.bulkCreate as jest.Mock).mock.calls[0][0];
      expect(rows.map((row: { scheduledAt: Date }) => row.scheduledAt.toISOString().slice(0, 10))).toEqual([
        '2027-03-09',
        '2027-03-18',
      ]);
      expect(draft.weeks[0].workoutIds).toEqual(['w-0']);
      expect(goalModel.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('training.plan.started', expect.anything());
    });

    it('returns ACTIVE_PLAN_EXISTS with the active plan summary when replaceActive is false', async () => {
      (planModel.findByPk as jest.Mock).mockResolvedValue(makePlan());
      (planModel.findOne as jest.Mock).mockResolvedValue(activePlan());

      await expect(
        service.startPlan('plan-1', { startDate: '2027-03-08', replaceActive: false }),
      ).rejects.toMatchObject({
        code: 'ACTIVE_PLAN_EXISTS',
        details: {
          activePlan: expect.objectContaining({
            id: 'plan-active',
            name: 'Trail 50K',
            currentWeek: 3,
            totalWeeks: 10,
            completedWorkouts: 3,
            futurePlannedWorkouts: 5,
          }),
        },
      });
      expect(workoutModel.bulkCreate).not.toHaveBeenCalled();
    });

    it('cancels and links the active plan with replaceActive', async () => {
      const draft = makePlan();
      const active = activePlan();
      (planModel.findByPk as jest.Mock).mockResolvedValue(draft);
      (planModel.findOne as jest.Mock).mockResolvedValue(active);

      await service.startPlan('plan-1', { startDate: '2027-03-08', replaceActive: true, timezone: 'UTC' });
      commit();

      expect(active.status).toBe('cancelled');
      expect(active.cancelReason).toBe('replaced');
      expect(active.replacedByPlanId).toBe('plan-1');
      expect(workoutModel.update).toHaveBeenCalledWith(
        { status: 'cancelled' },
        expect.objectContaining({ where: expect.objectContaining({ planId: 'plan-active', status: 'planned' }) }),
      );
      expect(goalModel.update).toHaveBeenCalledWith({ status: 'cancelled' }, expect.anything());
      expect(eventEmitter.emit).toHaveBeenCalledWith('training.plan.cancelled', expect.anything());
    });

    it('rejects a plan that is not a draft', async () => {
      (planModel.findByPk as jest.Mock).mockResolvedValue(activePlan());
      await expect(
        service.startPlan('plan-active', { startDate: '2027-03-08', replaceActive: false }),
      ).rejects.toMatchObject({ code: 'PLAN_INVALID_STATUS' });
    });

    it('rejects a start date in the past', async () => {
      (planModel.findByPk as jest.Mock).mockResolvedValue(makePlan());
      await expect(
        service.startPlan('plan-1', { startDate: '2027-03-01', replaceActive: false, timezone: 'UTC' }),
      ).rejects.toMatchObject({ code: 'PLAN_START_DATE_INVALID' });
    });

    it('converts a legacy dated draft and removes its stale workout rows', async () => {
      const legacy = makePlan({
        weeks: [{ weekNumber: 1, workoutIds: ['old-1'] }],
        startDate: '2026-01-05',
        endDate: '2026-01-11',
      });
      (planModel.findByPk as jest.Mock).mockResolvedValue(legacy);
      (workoutModel.findAll as jest.Mock).mockResolvedValue([
        {
          weekNumber: 1,
          orderInWeek: 1,
          scheduledAt: new Date('2026-01-07T00:00:00Z'),
          type: 'easy',
          phase: 'base',
          durationMinutes: 40,
          distanceKm: 6,
          target: {},
          steps: [],
        },
      ]);

      await service.startPlan('plan-1', { startDate: '2027-03-08', replaceActive: false });

      expect(workoutModel.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { planId: 'plan-1' } }));
      expect((workoutModel.bulkCreate as jest.Mock).mock.calls[0][0]).toHaveLength(1);
    });
  });

  describe('createPlan', () => {
    const input = (): CreatePlanInput => ({
      athleteId: 'athlete-1',
      name: 'New plan',
      config: { goal: { type: 'prepare_for_race' }, schedule: {}, structure: {} },
      creationSource: 'manual',
      trainingFrequency: 2,
      weeklyTargetKm: 30,
      weeks: relativeWeeks() as never,
      metricsSnapshot: null,
    });

    it('creates and starts in the same transaction', async () => {
      await service.createPlan(input(), { startDate: '2027-03-08', replaceActive: false });
      expect((planModel.sequelize as { transaction: jest.Mock }).transaction).toHaveBeenCalledTimes(1);
      expect(workoutModel.bulkCreate).toHaveBeenCalled();
    });

    it('propagates a rejected start so the transaction rolls the draft back', async () => {
      (planModel.findOne as jest.Mock).mockResolvedValue(activePlan());
      await expect(
        service.createPlan(input(), { startDate: '2027-03-08', replaceActive: false }),
      ).rejects.toMatchObject({ code: 'ACTIVE_PLAN_EXISTS' });
      expect(eventEmitter.emit).not.toHaveBeenCalledWith('training.plan.created', expect.anything());
    });

    it('enforces the per-athlete plan limit', async () => {
      (planModel.count as jest.Mock).mockResolvedValue(100);
      await expect(service.createPlan(input(), null)).rejects.toMatchObject({ code: 'PLANS_LIMIT_REACHED' });
    });

    it('clamps a past start date for legacy clients', async () => {
      const plan = await service.createPlan(
        input(),
        { startDate: '2027-03-02', replaceActive: true },
        { clampPastStartDate: true },
      );
      expect(plan.startDate).toBe('2027-03-03');
    });
  });

  describe('cancelActivePlan', () => {
    it('cancels future planned workouts and the goal', async () => {
      const active = activePlan();
      (planModel.findByPk as jest.Mock).mockResolvedValue(active);

      const result = await service.cancelActivePlan('plan-active', 'user', 'UTC');

      expect(result.cancelledWorkouts).toBe(3);
      expect(active.status).toBe('cancelled');
      expect(active.cancelReason).toBe('user');
    });

    it('rejects a plan that is not active', async () => {
      (planModel.findByPk as jest.Mock).mockResolvedValue(makePlan());
      await expect(service.cancelActivePlan('plan-1', 'user')).rejects.toMatchObject({ code: 'PLAN_INVALID_STATUS' });
    });
  });

  describe('completion', () => {
    it('completes an ended plan with its goal and emits an event', async () => {
      const ended = activePlan();
      ended.endDate = '2027-02-28';
      (planModel.findByPk as jest.Mock).mockResolvedValue(ended);

      await service.completeIfEnded(ended);
      commit();

      expect(ended.status).toBe('completed');
      expect(goalModel.update).toHaveBeenCalledWith({ status: 'completed' }, expect.anything());
      expect(eventEmitter.emit).toHaveBeenCalledWith('training.plan.completed', expect.anything());
    });

    it('keeps a plan that ended yesterday active (timezone slack)', async () => {
      const recent = activePlan();
      recent.endDate = '2027-03-02';
      await service.completeIfEnded(recent);
      expect(recent.status).toBe('active');
    });
  });

  describe('buildStartOptions', () => {
    it('aligns the plan so that the race day falls into the last week', async () => {
      // 2027-09-19 is a Sunday; its week starts on Monday 2027-09-13.
      const options = await service.buildStartOptions({
        athleteId: 'athlete-1',
        totalWeeks: 2,
        targetDate: '2027-09-19',
      });
      const aligned = options.options.find((option) => option.kind === 'race_aligned')!;

      expect(aligned).toEqual(expect.objectContaining({ startDate: '2027-09-06', endDate: '2027-09-19', fits: true }));
      expect(options.recommended).toBe('race_aligned');
    });

    it('reports how many weeks are left when the plan does not fit', async () => {
      const options = await service.buildStartOptions({
        athleteId: 'athlete-1',
        totalWeeks: 16,
        targetDate: '2027-04-04',
      });
      const aligned = options.options.find((option) => option.kind === 'race_aligned')!;
      expect(aligned.fits).toBe(false);
      expect(aligned.weeksAvailable).toBe(5);
      expect(options.recommended).toBe('next_monday');
    });

    it('marks a passed target date', async () => {
      const options = await service.buildStartOptions({
        athleteId: 'athlete-1',
        totalWeeks: 4,
        targetDate: '2026-01-01',
      });
      expect(options.options[2]).toEqual(expect.objectContaining({ fits: false, reason: 'target_date_passed' }));
    });
  });
});
