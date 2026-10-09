import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Op } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';

import { Athlete } from '../entities/athlete.entity';
import { AthleteState } from '../entities/athlete-state.entity';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { TrainingEngine } from '../training.engine';
import { TrainingService } from '../training.service';
import { AthleteMetricsService } from './athlete-metrics.service';
import { PlanEditingService } from './plan-editing.service';
import { PlanLifecycleService } from './plan-lifecycle.service';
import { PlanRebuildService, RebuildInput } from './plan-rebuild.service';

describe('AthleteMetricsService', () => {
  let service: AthleteMetricsService;
  let workoutModel: { findAll: jest.Mock };

  beforeEach(async () => {
    workoutModel = { findAll: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AthleteMetricsService,
        { provide: getModelToken(Athlete), useValue: { findByPk: jest.fn().mockResolvedValue(null) } },
        {
          provide: getModelToken(AthleteState),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              thresholdPaceSecondsPerKm: 285,
              thresholdHeartRate: 168,
            }),
          },
        },
        { provide: getModelToken(Workout), useValue: workoutModel },
      ],
    }).compile();

    service = moduleRef.get(AthleteMetricsService);
  });

  it('estimates volume from completed manual workouts', async () => {
    const now = Date.now();
    workoutModel.findAll.mockResolvedValue(
      [0, 7, 14, 21].map((daysAgo) => ({
        status: 'completed',
        completedAt: new Date(now - daysAgo * 86_400_000),
        actual: { actualDistanceKm: 10, actualDurationMinutes: 55 },
        sourceProvider: 'manual',
      })),
    );

    const metrics = await service.currentMetrics('athlete-1');

    expect(metrics.weeklyMileageKm.value).toBe(10);
    expect(metrics.weeklyMileageKm.source).toBe('manual_workouts');
    expect(metrics.thresholdPaceSecondsPerKm.value).toBe(285);
    expect(metrics.thresholdPaceSecondsPerKm.source).toBe('athlete_state');
  });

  it('returns null volume when there are too few completed workouts', async () => {
    workoutModel.findAll.mockResolvedValue([
      {
        status: 'completed',
        completedAt: new Date(),
        actual: { actualDistanceKm: 10, actualDurationMinutes: 55 },
        sourceProvider: 'manual',
      },
    ]);

    const metrics = await service.currentMetrics('athlete-1');

    expect(metrics.weeklyMileageKm.value).toBeNull();
    expect(metrics.weeklyMileageKm.source).toBe('none');
  });

  it('validates metric ranges', () => {
    const violations = service.validateMetrics({
      thresholdPaceSecondsPerKm: 100,
      weeklyMileageKm: 500,
      maxHeartRate: 190,
      restingHeartRate: 195,
    });

    expect(violations).toContain('thresholdPaceSecondsPerKm_out_of_range');
    expect(violations).toContain('weeklyMileageKm_out_of_range');
    expect(violations).toContain('resting_heart_rate_not_below_max');
  });

  it('queries only completed workouts from the result window', async () => {
    await service.currentMetrics('athlete-1');

    expect(workoutModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }),
      }),
    );
    const where = workoutModel.findAll.mock.calls[0][0].where;
    expect(where.completedAt[Op.gte]).toBeInstanceOf(Date);
  });
});

describe('PlanRebuildService', () => {
  let service: PlanRebuildService;
  let workoutModel: { findAll: jest.Mock; findOne: jest.Mock };
  let lifecycle: { createPlan: jest.Mock; buildStartOptions: jest.Mock; inTransaction: jest.Mock };
  let editing: { loadOwnedPlan: jest.Mock };
  let training: { generateFromConfig: jest.Mock };
  const engine = new TrainingEngine();

  /** Completed 3-week source plan, starting Monday 2026-03-02. */
  const sourceWorkouts = (): Array<Record<string, unknown>> =>
    [
      { weekNumber: 1, orderInWeek: 1, scheduledAt: new Date('2026-03-03T00:00:00Z'), type: 'easy', distance: 8 },
      { weekNumber: 1, orderInWeek: 2, scheduledAt: new Date('2026-03-07T00:00:00Z'), type: 'long_run', distance: 16 },
      { weekNumber: 2, orderInWeek: 1, scheduledAt: new Date('2026-03-10T00:00:00Z'), type: 'tempo', distance: 10 },
      { weekNumber: 2, orderInWeek: 2, scheduledAt: new Date('2026-03-14T00:00:00Z'), type: 'long_run', distance: 18 },
      { weekNumber: 3, orderInWeek: 1, scheduledAt: new Date('2026-03-17T00:00:00Z'), type: 'easy', distance: 8 },
    ].map((row) => ({
      ...row,
      phase: 'base',
      status: 'completed',
      durationMinutes: Math.round(Number(row.distance) * 6),
      distanceKm: row.distance,
      target: engine.rebuildWorkoutTarget({
        type: row.type as 'easy',
        durationMinutes: 40,
        thresholdPaceSecondsPerKm: 285,
      }).target,
      steps: [],
    }));

  const makePlan = (overrides: Partial<Record<string, unknown>> = {}): TrainingPlan =>
    ({
      id: 'plan-old',
      athleteId: 'athlete-1',
      goalId: 'goal-1',
      name: 'Marathon 2026',
      status: 'completed',
      startDate: '2026-03-02',
      endDate: '2026-03-22',
      version: 3,
      weeks: [],
      creationSource: 'manual',
      weeklyTargetKm: 55,
      metricsSnapshot: { capturedAt: '2026-03-01T00:00:00Z', thresholdPaceSecondsPerKm: 285, weeklyMileageKm: 40 },
      config: {
        goal: { type: 'prepare_for_race', target: { distanceMeters: 42195 }, targetDate: '2026-03-22' },
        schedule: { trainingDays: [1, 5], preferredLongRunDay: 5 },
        structure: { totalWeeks: 3, sessionsPerWeek: 2, focus: [] },
      },
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    }) as unknown as TrainingPlan;

  const buildInput = (overrides: Partial<RebuildInput> = {}): RebuildInput =>
    ({
      goal: { type: 'prepare_for_race', target: { distanceMeters: 42195 }, targetDate: '2027-03-21' },
      schedule: { trainingDays: [1, 5], preferredLongRunDay: 5 },
      structure: { totalWeeks: 3, sessionsPerWeek: 2, focus: [] },
      metrics: { thresholdPaceSecondsPerKm: 270, weeklyMileageKm: 30 },
      target: 'new_draft',
      ...overrides,
    }) as RebuildInput;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-11T08:00:00Z'));
    workoutModel = {
      findAll: jest.fn().mockResolvedValue(sourceWorkouts()),
      findOne: jest.fn().mockResolvedValue(null),
    };
    lifecycle = {
      createPlan: jest.fn().mockResolvedValue({ id: 'plan-new' }),
      buildStartOptions: jest.fn().mockResolvedValue({
        today: '2027-01-11',
        totalWeeks: 3,
        options: [{ kind: 'today', startDate: '2027-01-11', endDate: '2027-01-31' }],
        recommended: 'today',
        metricsStale: false,
        activePlan: null,
      }),
      inTransaction: jest.fn(async (work: (transaction: unknown) => Promise<unknown>) =>
        work({ afterCommit: (callback: () => void) => callback() }),
      ),
    };
    editing = { loadOwnedPlan: jest.fn().mockResolvedValue(makePlan()) };
    training = { generateFromConfig: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanRebuildService,
        TrainingEngine,
        { provide: getModelToken(Workout), useValue: workoutModel },
        { provide: TrainingService, useValue: training },
        { provide: PlanLifecycleService, useValue: lifecycle },
        { provide: PlanEditingService, useValue: editing },
        {
          provide: AthleteMetricsService,
          useValue: {
            currentMetrics: jest.fn().mockResolvedValue({}),
            validateMetrics: jest.fn().mockReturnValue([]),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlanRebuildService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rebases the final version: volume scaled from the snapshot baseline, paces re-targeted', async () => {
    const result = await service.preview('plan-old', 'user-1', buildInput());

    expect(result.mode).toBe('rebased');
    expect(training.generateFromConfig).not.toHaveBeenCalled();
    // 30 km now vs 40 km at the source start → k = 0.75.
    const scale = result.diff.summary.adjustments.find((adjustment) => adjustment.code === 'VOLUME_SCALED');
    expect(scale?.params?.k).toBe(0.75);
    const tempo = result.weeks[1].workouts.find((workout) => workout.type === 'tempo')!;
    expect(tempo.target.paceMinSecondsPerKm).toBe(Math.round(270 * 0.98));
    expect(result.preview.startDate).toBe('2027-01-11');
  });

  it('falls back to the first two weeks volume when the source has no snapshot', async () => {
    editing.loadOwnedPlan.mockResolvedValue(makePlan({ metricsSnapshot: null }));
    const result = await service.preview('plan-old', 'user-1', buildInput({ metrics: { weeklyMileageKm: 26 } }));

    // Weeks 1-2 average (8 + 16 + 10 + 18) / 2 = 26 km → k = 1.
    const scale = result.diff.summary.adjustments.find((adjustment) => adjustment.code === 'VOLUME_SCALED');
    expect(scale?.params?.k).toBe(1);
  });

  it('regenerates when the structure changes, also for an in-place draft update', async () => {
    const generated = engine.generatePlan(
      {
        id: 'athlete-1',
        userId: 'user-1',
        age: null,
        sex: null,
        heightCm: null,
        weightKg: null,
        experienceLevel: 'intermediate',
        weeklyMileageKm: 30,
        sessionsPerWeek: 3,
        recentRaceResults: [],
        preferredTrainingDays: [],
        availableTrainingDays: ['tuesday', 'thursday', 'saturday'],
        preferredWorkoutDurationMinutes: 45,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'g',
        athleteId: 'athlete-1',
        type: 'prepare_for_race',
        payload: { target: { distanceMeters: 42195 } },
        raceDistance: 'marathon',
        targetTimeSeconds: null,
        targetDate: null,
        priority: 5,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        fitness: 40,
        fatigue: 30,
        form: 10,
        weeklyLoad: 200,
        acuteLoad: 200,
        chronicLoad: 200,
        recoveryScore: 70,
        thresholdPaceSecondsPerKm: 270,
        thresholdHeartRate: null,
        vo2max: null,
        confidence: 0.6,
        source: 'test',
      },
      new Date('2027-01-11T00:00:00Z'),
      { totalWeeks: 6 },
    );
    training.generateFromConfig.mockResolvedValue(generated);
    editing.loadOwnedPlan.mockResolvedValue(
      makePlan({ status: 'draft', startDate: null, endDate: null, weeks: engine.toRelativeWeeks(generated) }),
    );

    const result = await service.preview(
      'plan-draft',
      'user-1',
      buildInput({ target: 'in_place', structure: { totalWeeks: 6, sessionsPerWeek: 3, focus: [] } }),
    );

    expect(result.mode).toBe('regenerated');
    expect(result.warnings).toContain('STRUCTURE_CHANGED_REGENERATED');
    expect(result.weeks).toHaveLength(6);
    expect(training.generateFromConfig).toHaveBeenCalledWith(
      'athlete-1',
      expect.objectContaining({ structure: { totalWeeks: 6, sessionsPerWeek: 3, focus: [] } }),
    );
  });

  it('creates and starts the new plan in a single lifecycle call; the source stays untouched', async () => {
    const source = makePlan();
    editing.loadOwnedPlan.mockResolvedValue(source);
    const start = { startDate: '2027-01-11', replaceActive: false, timezone: 'Europe/Moscow' };

    await service.rebuild('plan-old', 'user-1', buildInput({ start }));

    expect(lifecycle.createPlan).toHaveBeenCalledTimes(1);
    const [input, startArg] = lifecycle.createPlan.mock.calls[0];
    expect(input).toEqual(expect.objectContaining({ sourcePlanId: 'plan-old', name: 'Marathon 2026 2027' }));
    expect(startArg).toEqual(start);
    expect(source.save).not.toHaveBeenCalled();
  });

  it('keeps the rebuilt plan as a draft with saveAsDraft', async () => {
    await service.rebuild(
      'plan-old',
      'user-1',
      buildInput({ saveAsDraft: true, start: { startDate: '2027-01-11', replaceActive: false } }),
    );
    expect(lifecycle.createPlan.mock.calls[0][1]).toBeNull();
  });

  it('rejects edits of unknown workouts instead of skipping them', async () => {
    await expect(
      service.rebuild(
        'plan-old',
        'user-1',
        buildInput({ weekOverrides: [{ weekNumber: 1, removedWorkoutKeys: ['w1-9'] }] }),
      ),
    ).rejects.toMatchObject({ code: 'PLAN_CHANGE_INVALID' });
  });

  it('requires the draft version for an in-place update', async () => {
    const draft = makePlan({ status: 'draft', startDate: null, endDate: null, weeks: [], version: 4 });
    editing.loadOwnedPlan.mockResolvedValue(draft);

    await expect(
      service.rebuild('plan-draft', 'user-1', buildInput({ target: 'in_place', expectedVersion: 3 })),
    ).rejects.toMatchObject({ code: 'PLAN_VERSION_CONFLICT' });
  });

  it('refuses an in-place rebuild of a history plan', async () => {
    await expect(service.preview('plan-old', 'user-1', buildInput({ target: 'in_place' }))).rejects.toBeInstanceOf(
      DomainException,
    );
  });

  it('prefills the parameters and drops a target date that has passed', async () => {
    const result = await service.prefill('plan-old', 'user-1', 'UTC');
    expect(result.goalSuggestion.targetDate).toBeNull();
    expect(result.goalSuggestion.previousTargetDate).toBe('2026-03-22');
    expect(result.config.structure).toEqual({ totalWeeks: 3, sessionsPerWeek: 2, focus: [] });
  });
});
