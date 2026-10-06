import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';

import { EntityAlreadyExistsException } from '@/common/exceptions/entity-already-exists.exception';
import { AdaptationEvent } from '@/modules/training/entities/adaptation-event.entity';
import { Athlete } from '@/modules/training/entities/athlete.entity';
import { AthleteGoal } from '@/modules/training/entities/athlete-goal.entity';
import { AthleteState } from '@/modules/training/entities/athlete-state.entity';
import { TrainingLoad } from '@/modules/training/entities/training-load.entity';
import { TrainingPlan } from '@/modules/training/entities/training-plan.entity';
import { Workout } from '@/modules/training/entities/workout.entity';
import { AthleteMetricsService } from '@/modules/training/plans/athlete-metrics.service';
import { PlanLifecycleService } from '@/modules/training/plans/plan-lifecycle.service';
import { PlanStatsService } from '@/modules/training/plans/plan-stats.service';
import { TrainingEngine } from '@/modules/training/training.engine';
import { TrainingService } from '@/modules/training/training.service';

type AthleteRecord = {
  id: string;
  userId: string;
  age: number | null;
  sex: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null;
  heightCm: number | null;
  weightKg: number | null;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  weeklyMileageKm: number | null;
  sessionsPerWeek: number;
  recentRaceResults: Array<Record<string, unknown>>;
  preferredTrainingDays: string[];
  availableTrainingDays: string[];
  preferredWorkoutDurationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type GoalRecord = {
  id: string;
  athleteId: string;
  raceDistance: '5k' | '10k' | 'half_marathon' | 'marathon';
  targetTimeSeconds: number | null;
  targetDate: string;
  priority: number;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  save?: () => Promise<GoalRecord>;
};

type StateRecord = {
  id: string;
  athleteId: string;
  fitness: number;
  fatigue: number;
  form: number;
  thresholdPaceSecondsPerKm: number | null;
  thresholdHeartRate: number | null;
  vo2max: number | null;
  weeklyLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  recoveryScore: number | null;
  confidence: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

type PlanRecord = {
  id: string;
  athleteId: string;
  goalId: string | null;
  name: string;
  startDate: string | null;
  endDate: string | null;
  config: Record<string, unknown>;
  metricsSnapshot: Record<string, unknown> | null;
  creationSource: string;
  version: number;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  replacedByPlanId?: string | null;
  trainingFrequency: number;
  weeklyTargetKm: number;
  status: 'draft' | 'active' | 'completed' | 'paused' | 'cancelled';
  algorithmVersion: string;
  weeks: Array<Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<PlanRecord>;
};

type WorkoutRecord = {
  id: string;
  athleteId: string;
  goalId: string | null;
  planId: string | null;
  weekNumber: number;
  scheduledAt: Date;
  type: 'recovery' | 'easy' | 'long_run' | 'tempo' | 'threshold' | 'interval' | 'hill' | 'race' | 'rest';
  phase: string;
  status: 'planned' | 'completed' | 'skipped' | 'cancelled';
  orderInWeek: number;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  actual: Record<string, unknown> | null;
  analysis: Record<string, unknown> | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<WorkoutRecord>;
};

type TrainingLoadRecord = {
  id: string;
  athleteId: string;
  workoutId: string | null;
  occurredAt: Date;
  load: number;
  intensityFactor: number;
  algorithmVersion: string;
};

type AdaptationRecord = {
  id: string;
  athleteId: string;
  planId: string | null;
  workoutId: string | null;
  type: string;
  input: Record<string, unknown>;
  decision: Record<string, unknown>;
  reason: string;
  confidence: number;
  createdAt: Date;
};

describe('Training loop (e2e)', () => {
  let moduleRef: TestingModule;
  let trainingService: TrainingService;

  const emit = jest.fn();
  const eventEmitter = { emit } as unknown as EventEmitter2;

  const users = new Map<string, { id: string; email: string }>();
  const athletes = new Map<string, AthleteRecord>();
  const goals = new Map<string, GoalRecord>();
  const states = new Map<string, StateRecord[]>();
  const plans = new Map<string, PlanRecord>();
  const workouts = new Map<string, WorkoutRecord>();
  const trainingLoads: TrainingLoadRecord[] = [];
  const adaptations: AdaptationRecord[] = [];
  let lastWorkoutLookupId: string | null = null;

  function resetStores(): void {
    users.clear();
    athletes.clear();
    goals.clear();
    states.clear();
    plans.clear();
    workouts.clear();
    trainingLoads.splice(0, trainingLoads.length);
    adaptations.splice(0, adaptations.length);
    lastWorkoutLookupId = null;
    emit.mockClear();
  }

  function createAthleteModel(): typeof Athlete {
    return {
      findOne: jest.fn(async (options: { where?: { userId?: string } }) => {
        const userId = options.where?.userId;
        if (!userId) {
          return null;
        }

        return Array.from(athletes.values()).find((athlete) => athlete.userId === userId) ?? null;
      }),
      create: jest.fn(async (data: Partial<AthleteRecord>) => {
        const now = new Date('2026-09-11T00:00:00.000Z');
        const athlete: AthleteRecord = {
          id: `athlete-${athletes.size + 1}`,
          userId: String(data.userId),
          age: (data.age as number | null | undefined) ?? null,
          sex: (data.sex as AthleteRecord['sex']) ?? null,
          heightCm: (data.heightCm as number | null | undefined) ?? null,
          weightKg: (data.weightKg as number | null | undefined) ?? null,
          experienceLevel: (data.experienceLevel as AthleteRecord['experienceLevel']) ?? 'intermediate',
          weeklyMileageKm: (data.weeklyMileageKm as number | null | undefined) ?? null,
          sessionsPerWeek: (data.sessionsPerWeek as number | undefined) ?? 4,
          recentRaceResults: ((data.recentRaceResults as Array<Record<string, unknown>> | undefined) ?? []).map(
            (entry) => ({
              ...entry,
            }),
          ),
          preferredTrainingDays: (data.preferredTrainingDays as string[] | undefined) ?? [],
          availableTrainingDays: (data.availableTrainingDays as string[] | undefined) ?? [],
          preferredWorkoutDurationMinutes: (data.preferredWorkoutDurationMinutes as number | null | undefined) ?? null,
          createdAt: now,
          updatedAt: now,
        };

        athletes.set(athlete.id, athlete);
        return athlete;
      }),
      findByPk: jest.fn(async (id: string) => athletes.get(id) ?? null),
    } as unknown as typeof Athlete;
  }

  function createGoalModel(): typeof AthleteGoal {
    return {
      create: jest.fn(async (data: Partial<GoalRecord>) => {
        const now = new Date('2026-09-11T00:00:00.000Z');
        const goal: GoalRecord = {
          id: `goal-${goals.size + 1}`,
          athleteId: String(data.athleteId),
          raceDistance: (data.raceDistance as GoalRecord['raceDistance']) ?? '10k',
          targetTimeSeconds: (data.targetTimeSeconds as number | null | undefined) ?? null,
          targetDate: String(data.targetDate),
          priority: (data.priority as number | undefined) ?? 5,
          status: (data.status as GoalRecord['status']) ?? 'active',
          notes: (data.notes as string | null | undefined) ?? null,
          createdAt: now,
          updatedAt: now,
        };
        goal.save = async (): Promise<GoalRecord> => goal;

        goals.set(goal.id, goal);
        return goal;
      }),
      update: jest.fn(async (values: Partial<GoalRecord>, options: { where: { id: string } }) => {
        const goal = goals.get(options.where.id);
        if (goal) {
          Object.assign(goal, values);
        }
        return [goal ? 1 : 0];
      }),
      findByPk: jest.fn(async (id: string) => goals.get(id) ?? null),
      findOne: jest.fn(async (options: { where?: { athleteId?: string } }) => {
        const athleteId = options.where?.athleteId;
        if (!athleteId) {
          return null;
        }

        return (
          Array.from(goals.values())
            .filter((goal) => goal.athleteId === athleteId)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
        );
      }),
    } as unknown as typeof AthleteGoal;
  }

  function createStateModel(): typeof AthleteState {
    return {
      create: jest.fn(async (data: Partial<StateRecord>) => {
        const now = new Date('2026-09-11T00:00:00.000Z');
        const state: StateRecord = {
          id: `state-${(states.get(String(data.athleteId))?.length ?? 0) + 1}`,
          athleteId: String(data.athleteId),
          fitness: Number(data.fitness),
          fatigue: Number(data.fatigue),
          form: Number(data.form),
          thresholdPaceSecondsPerKm: (data.thresholdPaceSecondsPerKm as number | null | undefined) ?? null,
          thresholdHeartRate: (data.thresholdHeartRate as number | null | undefined) ?? null,
          vo2max: (data.vo2max as number | null | undefined) ?? null,
          weeklyLoad: Number(data.weeklyLoad),
          acuteLoad: Number(data.acuteLoad),
          chronicLoad: Number(data.chronicLoad),
          recoveryScore: (data.recoveryScore as number | null | undefined) ?? null,
          confidence: Number(data.confidence),
          source: String(data.source),
          createdAt: now,
          updatedAt: now,
        };

        const existing = states.get(state.athleteId) ?? [];
        states.set(state.athleteId, [...existing, state]);
        return state;
      }),
      findOne: jest.fn(async (options: { where?: { athleteId?: string } }) => {
        const athleteId = options.where?.athleteId;
        if (!athleteId) {
          return null;
        }

        const snapshots = states.get(athleteId) ?? [];
        return snapshots.slice().sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
      }),
    } as unknown as typeof AthleteState;
  }

  function createPlanModel(): typeof TrainingPlan {
    const matches = (plan: PlanRecord, where: Record<string, unknown> = {}): boolean =>
      Object.entries(where).every(([key, value]) => {
        if (value && typeof value === 'object') {
          // Only `{ [Op.ne]: id }` is used by the lifecycle service.
          return Object.getOwnPropertySymbols(value).every(
            (symbol) =>
              (plan as unknown as Record<string, unknown>)[key] !== (value as Record<symbol, unknown>)[symbol],
          );
        }
        return (plan as unknown as Record<string, unknown>)[key] === value;
      });

    return {
      create: jest.fn(async (data: Partial<PlanRecord>) => {
        const now = new Date('2026-09-11T00:00:00.000Z');
        const plan = {
          version: 0,
          metricsSnapshot: null,
          creationSource: 'ai',
          config: {},
          name: 'Training Plan',
          ...data,
          id: `plan-${plans.size + 1}`,
          goalId: (data.goalId as string | null | undefined) ?? null,
          status: (data.status as PlanRecord['status']) ?? 'active',
          weeks: Array.isArray(data.weeks) ? [...data.weeks] : [],
          createdAt: now,
          updatedAt: now,
        } as PlanRecord;
        plan.save = jest.fn(async () => {
          plan.updatedAt = new Date();
          plan.version += 1;
          plans.set(plan.id, plan);
          return plan;
        });

        plans.set(plan.id, plan);
        return plan;
      }),
      findByPk: jest.fn(async (id: string) => plans.get(id) ?? null),
      findOne: jest.fn(
        async (options: { where?: Record<string, unknown> }) =>
          Array.from(plans.values()).find((plan) => matches(plan, options.where)) ?? null,
      ),
      findAll: jest.fn(async (options: { where?: Record<string, unknown> }) =>
        Array.from(plans.values()).filter((plan) => plan.status === options.where?.status),
      ),
      count: jest.fn(
        async (options: { where?: Record<string, unknown> }) =>
          Array.from(plans.values()).filter((plan) => matches(plan, options.where)).length,
      ),
      increment: jest.fn(),
      sequelize: {
        transaction: jest.fn(async (work: (transaction: unknown) => Promise<unknown>) =>
          work({ LOCK: { UPDATE: 'UPDATE' }, afterCommit: (callback: () => void) => callback() }),
        ),
      },
    } as unknown as typeof TrainingPlan;
  }

  function createWorkoutModel(): typeof Workout {
    const model: Record<string, unknown> = {
      bulkCreate: jest.fn(async (rows: Array<Partial<WorkoutRecord>>) => {
        const created: unknown[] = [];
        for (const row of rows) {
          created.push(await (model.create as (data: Partial<WorkoutRecord>) => Promise<unknown>)(row));
        }
        return created;
      }),
    };
    return Object.assign(model, {
      create: jest.fn(async (data: Partial<WorkoutRecord>) => {
        const now = new Date('2026-09-11T00:00:00.000Z');
        const workout: WorkoutRecord = {
          id: `workout-${workouts.size + 1}`,
          athleteId: String(data.athleteId),
          goalId: (data.goalId as string | null | undefined) ?? null,
          planId: (data.planId as string | null | undefined) ?? null,
          weekNumber: Number(data.weekNumber),
          scheduledAt: new Date(String(data.scheduledAt)),
          type: data.type as WorkoutRecord['type'],
          phase: String(data.phase),
          status: (data.status as WorkoutRecord['status']) ?? 'planned',
          orderInWeek: Number(data.orderInWeek),
          durationMinutes: Number(data.durationMinutes),
          distanceKm: Number(data.distanceKm),
          target: (data.target as Record<string, unknown>) ?? {},
          steps: (data.steps as Array<Record<string, unknown>>) ?? [],
          actual: (data.actual as Record<string, unknown> | null | undefined) ?? null,
          analysis: (data.analysis as Record<string, unknown> | null | undefined) ?? null,
          completedAt: (data.completedAt as Date | null | undefined) ?? null,
          createdAt: now,
          updatedAt: now,
          save: jest.fn(async () => {
            workout.updatedAt = new Date();
            workouts.set(workout.id, workout);
            return workout;
          }),
        };

        workouts.set(workout.id, workout);
        return workout;
      }),
      findByPk: jest.fn(async (id: string) => {
        lastWorkoutLookupId = id;
        return workouts.get(id) ?? null;
      }),
      findAll: jest.fn(async (options: { where?: { planId?: string; status?: string } }) => {
        const planId = options.where?.planId;
        if (!planId) {
          return [];
        }

        const values = Array.from(workouts.values()).filter((workout) => workout.planId === planId);
        if (options.where?.status !== 'planned') {
          return values.sort(
            (left, right) => left.weekNumber - right.weekNumber || left.orderInWeek - right.orderInWeek,
          );
        }

        if (!lastWorkoutLookupId) {
          return values
            .filter((workout) => workout.status === 'planned')
            .sort((left, right) => left.weekNumber - right.weekNumber || left.orderInWeek - right.orderInWeek);
        }

        const currentWorkout = workouts.get(lastWorkoutLookupId);
        if (!currentWorkout) {
          return [];
        }

        return values
          .filter(
            (workout) =>
              workout.status === 'planned' &&
              (workout.weekNumber > currentWorkout.weekNumber ||
                (workout.weekNumber === currentWorkout.weekNumber && workout.orderInWeek > currentWorkout.orderInWeek)),
          )
          .sort((left, right) => left.weekNumber - right.weekNumber || left.orderInWeek - right.orderInWeek);
      }),
      destroy: jest.fn(async (options: { where?: { planId?: string } }) => {
        const planId = options.where?.planId;
        if (!planId) {
          return 0;
        }

        let deleted = 0;
        for (const [key, workout] of workouts.entries()) {
          if (workout.planId === planId) {
            workouts.delete(key);
            deleted += 1;
          }
        }

        return deleted;
      }),
      count: jest.fn(async () => workouts.size),
      update: jest.fn(async (values: Partial<WorkoutRecord>, options: { where: Record<string, unknown> }) => {
        const fromDate = Object.getOwnPropertySymbols(options.where.scheduledAt ?? {}).map(
          (symbol) => (options.where.scheduledAt as Record<symbol, Date>)[symbol],
        )[0];
        let updated = 0;
        for (const workout of workouts.values()) {
          if (
            workout.planId === options.where.planId &&
            workout.status === options.where.status &&
            (!fromDate || workout.scheduledAt >= fromDate)
          ) {
            Object.assign(workout, values);
            updated += 1;
          }
        }
        return [updated];
      }),
      sequelize: { query: jest.fn(async () => []) },
    }) as unknown as typeof Workout;
  }

  function createTrainingLoadModel(): typeof TrainingLoad {
    return {
      create: jest.fn(async (data: Partial<TrainingLoadRecord>) => {
        const record: TrainingLoadRecord = {
          id: `load-${trainingLoads.length + 1}`,
          athleteId: String(data.athleteId),
          workoutId: (data.workoutId as string | null | undefined) ?? null,
          occurredAt: new Date(String(data.occurredAt)),
          load: Number(data.load),
          intensityFactor: Number(data.intensityFactor),
          algorithmVersion: String(data.algorithmVersion),
        };

        trainingLoads.push(record);
        return record;
      }),
      findAll: jest.fn(async (options: { where?: { athleteId?: string } }) => {
        const athleteId = options.where?.athleteId;
        return athleteId ? trainingLoads.filter((load) => load.athleteId === athleteId) : trainingLoads;
      }),
      count: jest.fn(async () => trainingLoads.length),
    } as unknown as typeof TrainingLoad;
  }

  function createAdaptationModel(): typeof AdaptationEvent {
    return {
      create: jest.fn(async (data: Partial<AdaptationRecord>) => {
        const record: AdaptationRecord = {
          id: `adaptation-${adaptations.length + 1}`,
          athleteId: String(data.athleteId),
          planId: (data.planId as string | null | undefined) ?? null,
          workoutId: (data.workoutId as string | null | undefined) ?? null,
          type: String(data.type),
          input: (data.input as Record<string, unknown>) ?? {},
          decision: (data.decision as Record<string, unknown>) ?? {},
          reason: String(data.reason),
          confidence: Number(data.confidence),
          createdAt: new Date('2026-09-11T00:00:00.000Z'),
        };

        adaptations.push(record);
        return record;
      }),
      findOne: jest.fn(async () => adaptations[adaptations.length - 1] ?? null),
      count: jest.fn(async () => adaptations.length),
    } as unknown as typeof AdaptationEvent;
  }

  beforeEach(async () => {
    // Plans in the scenarios start on 2026-09-15; "today" is the day before.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-09-14T08:00:00Z'));
    resetStores();

    moduleRef = await Test.createTestingModule({
      providers: [
        TrainingService,
        TrainingEngine,
        PlanLifecycleService,
        PlanStatsService,
        AthleteMetricsService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(100) } },
        { provide: getModelToken(Athlete), useValue: createAthleteModel() },
        { provide: getModelToken(AthleteGoal), useValue: createGoalModel() },
        { provide: getModelToken(AthleteState), useValue: createStateModel() },
        { provide: getModelToken(TrainingPlan), useValue: createPlanModel() },
        { provide: getModelToken(Workout), useValue: createWorkoutModel() },
        { provide: getModelToken(TrainingLoad), useValue: createTrainingLoadModel() },
        { provide: getModelToken(AdaptationEvent), useValue: createAdaptationModel() },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    trainingService = moduleRef.get(TrainingService);
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('creates athlete, goal, plan and adapts future training after workout completion', async () => {
    const athlete = await trainingService.createAthlete('user-1', {
      age: 31,
      sex: 'male',
      heightCm: 178,
      weightKg: 74,
      experienceLevel: 'intermediate',
      weeklyMileageKm: 38,
      sessionsPerWeek: 4,
      recentRaceResults: [{ distance: '5k', paceSecondsPerKm: 260 }],
      preferredTrainingDays: ['tuesday', 'thursday', 'saturday'],
      availableTrainingDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
      preferredWorkoutDurationMinutes: 50,
    });

    expect(athlete.id).toBeDefined();
    expect(emit).toHaveBeenCalledWith('training.athlete.created', expect.any(Object));
    expect(emit).toHaveBeenCalledWith('training.state.updated', expect.any(Object));

    const goal = await trainingService.createGoal('user-1', {
      athleteId: athlete.id,
      goal: {
        type: 'improve_race_result',
        current: { finishTimeSec: 2910 },
        target: { distanceMeters: 10_000, finishTimeSec: 2700 },
        targetDate: '2026-11-01',
        priority: 5,
      },
      notes: 'Sub-45 target',
    });

    const plan = await trainingService.createPlan('user-1', {
      athleteId: athlete.id,
      goalId: goal.id,
      startDate: '2026-09-15',
      targetTrainingFrequency: 4,
    });

    expect(plan.workouts.length).toBeGreaterThan(0);

    const hardWorkout =
      plan.workouts.find((workout) => workout.type === 'threshold' || workout.type === 'interval') ?? plan.workouts[0];

    const completion = await trainingService.completeWorkout('user-1', hardWorkout.id, {
      actualDurationMinutes: Math.max(20, hardWorkout.durationMinutes - 12),
      actualDistanceKm: Math.max(2, hardWorkout.distanceKm - 3),
      actualAveragePaceSecondsPerKm: 360,
      actualAverageHeartRate: 172,
      rpe: 8,
      notes: 'Felt hard',
    });

    expect(completion.analysis.load).toBeGreaterThan(0);
    expect(completion.adaptation.type).not.toBe('KEEP');
    expect(adaptations.length).toBe(1);
    expect(trainingLoads.length).toBe(1);
    expect(emit).toHaveBeenCalledWith('training.workout.completed', expect.any(Object));
    expect(emit).toHaveBeenCalledWith('training.state.updated', expect.any(Object));
    expect(emit).toHaveBeenCalledWith('training.plan.adapted', expect.any(Object));

    const reloadedPlan = await trainingService.getPlan(plan.id, 'user-1');
    expect(reloadedPlan.workouts.some((workout) => workout.type === 'recovery' || workout.type === 'easy')).toBe(true);
  });

  it('rejects duplicate athlete creation for the same user', async () => {
    await trainingService.createAthlete('user-1', {
      experienceLevel: 'intermediate',
    });

    await expect(
      trainingService.createAthlete('user-1', {
        experienceLevel: 'intermediate',
      }),
    ).rejects.toBeInstanceOf(EntityAlreadyExistsException);
  });

  it('keeps one active plan: a start over an active plan needs explicit confirmation', async () => {
    const athlete = await trainingService.createAthlete('user-1', {
      experienceLevel: 'intermediate',
      weeklyMileageKm: 30,
      availableTrainingDays: ['tuesday', 'thursday', 'saturday'],
    });
    const goal = await trainingService.createGoal('user-1', {
      athleteId: athlete.id,
      goal: { type: 'prepare_for_race', target: { distanceMeters: 10_000 }, targetDate: '2026-11-29', priority: 5 },
    });
    const lifecycle = moduleRef.get(PlanLifecycleService);

    const first = await trainingService.createPlan('user-1', {
      athleteId: athlete.id,
      goalId: goal.id,
      start: { startDate: '2026-09-15', replaceActive: false },
    });
    const draft = await trainingService.createPlan('user-1', {
      athleteId: athlete.id,
      goalId: goal.id,
      saveAsDraft: true,
    });
    expect(first.status).toBe('active');
    expect(draft.status).toBe('draft');

    await expect(
      lifecycle.startPlan(draft.id, { startDate: '2026-09-21', replaceActive: false }),
    ).rejects.toMatchObject({ code: 'ACTIVE_PLAN_EXISTS' });
    expect(plans.get(first.id)?.status).toBe('active');

    await lifecycle.startPlan(draft.id, { startDate: '2026-09-21', replaceActive: true });
    expect(plans.get(first.id)?.status).toBe('cancelled');
    expect(plans.get(draft.id)?.status).toBe('active');
    const activeCount = Array.from(plans.values()).filter((plan) => plan.status === 'active').length;
    expect(activeCount).toBe(1);
    const firstPlanned = Array.from(workouts.values()).filter(
      (workout) => workout.planId === first.id && workout.status === 'planned',
    );
    expect(firstPlanned).toHaveLength(0);
  });
});
