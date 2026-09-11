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
  status: 'active' | 'completed' | 'paused';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  startDate: string;
  endDate: string;
  trainingFrequency: number;
  weeklyTargetKm: number;
  status: 'draft' | 'active' | 'completed' | 'paused';
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

        goals.set(goal.id, goal);
        return goal;
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
    return {
      create: jest.fn(async (data: Partial<PlanRecord>) => {
        const now = new Date('2026-09-11T00:00:00.000Z');
        const plan: PlanRecord = {
          id: `plan-${plans.size + 1}`,
          athleteId: String(data.athleteId),
          goalId: (data.goalId as string | null | undefined) ?? null,
          startDate: String(data.startDate),
          endDate: String(data.endDate),
          trainingFrequency: Number(data.trainingFrequency),
          weeklyTargetKm: Number(data.weeklyTargetKm),
          status: (data.status as PlanRecord['status']) ?? 'active',
          algorithmVersion: String(data.algorithmVersion),
          weeks: Array.isArray(data.weeks) ? [...data.weeks] : [],
          createdAt: now,
          updatedAt: now,
          save: jest.fn(async () => {
            plan.updatedAt = new Date();
            plans.set(plan.id, plan);
            return plan;
          }),
        };

        plans.set(plan.id, plan);
        return plan;
      }),
      findByPk: jest.fn(async (id: string) => plans.get(id) ?? null),
    } as unknown as typeof TrainingPlan;
  }

  function createWorkoutModel(): typeof Workout {
    return {
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
    } as unknown as typeof Workout;
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
    resetStores();

    moduleRef = await Test.createTestingModule({
      providers: [
        TrainingService,
        TrainingEngine,
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
      raceDistance: '10k',
      targetTimeSeconds: 2700,
      targetDate: '2026-11-01',
      priority: 5,
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
});
