import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';

import { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { TrainingEngine } from '../training.engine';
import { PlanChangeCalculator } from './plan-change-calculator';
import { PlanStatsService } from './plan-stats.service';

/**
 * Active plan of 4 weeks starting Monday 2027-03-01. "Today" is Wednesday
 * 2027-03-10 (week 2): week 1 is history, week 2 is partly past.
 */
describe('PlanChangeCalculator', () => {
  let calculator: PlanChangeCalculator;
  const engine = new TrainingEngine();

  const target = (type: string): Record<string, unknown> =>
    engine.rebuildWorkoutTarget({ type: type as 'easy', durationMinutes: 40, thresholdPaceSecondsPerKm: 300 }).target;

  const row = (
    id: string,
    weekNumber: number,
    date: string,
    type: string,
    status = 'planned',
    distanceKm = 8,
  ): Workout =>
    ({
      id,
      weekNumber,
      orderInWeek: 1,
      scheduledAt: new Date(`${date}T00:00:00Z`),
      type,
      phase: weekNumber >= 4 ? 'taper' : 'build',
      status,
      durationMinutes: 45,
      distanceKm,
      target: target(type),
      steps: [],
    }) as unknown as Workout;

  const workouts = (): Workout[] => [
    row('a1', 1, '2027-03-02', 'easy', 'completed'),
    row('a2', 1, '2027-03-06', 'long_run', 'completed', 16),
    row('b1', 2, '2027-03-09', 'easy', 'completed'),
    row('b2', 2, '2027-03-11', 'tempo'),
    row('b3', 2, '2027-03-13', 'long_run', 'planned', 18),
    row('c1', 3, '2027-03-16', 'easy'),
    row('c2', 3, '2027-03-18', 'interval'),
    row('c3', 3, '2027-03-20', 'long_run', 'planned', 20),
    row('d1', 4, '2027-03-23', 'easy'),
    row('d2', 4, '2027-03-27', 'race', 'planned', 21),
  ];

  const plan = (): TrainingPlan =>
    ({
      id: 'plan-1',
      status: 'active',
      startDate: '2027-03-01',
      endDate: '2027-03-28',
      version: 2,
      metricsSnapshot: { capturedAt: '2027-02-28', thresholdPaceSecondsPerKm: 300 },
      config: {
        goal: { type: 'prepare_for_race', targetDate: '2027-03-27' },
        schedule: { trainingDays: [1, 3, 5] },
        structure: { totalWeeks: 4, sessionsPerWeek: 3 },
      },
      weeks: [1, 2, 3, 4].map((weekNumber) => ({
        weekNumber,
        phase: weekNumber === 4 ? 'taper' : 'build',
        weeklyLoadTarget: 40,
        workoutIds: [],
      })),
    }) as unknown as TrainingPlan;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-03-10T09:00:00Z'));
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanChangeCalculator,
        PlanStatsService,
        TrainingEngine,
        { provide: getModelToken(Workout), useValue: {} },
      ],
    }).compile();
    calculator = moduleRef.get(PlanChangeCalculator);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('workouts', () => {
    it('rebuilds pace targets when the type changes', () => {
      const change = calculator.compute(plan(), workouts(), {
        kind: 'workouts',
        expectedVersion: 2,
        timezone: 'UTC',
        operations: [{ op: 'update', workoutId: 'c1', type: 'tempo' }],
      });

      const patch = change.mutation.updates.find((update) => update.id === 'c1')!.patch;
      expect(patch.type).toBe('tempo');
      expect(patch.target?.paceMinSecondsPerKm).toBe(Math.round(300 * 0.98));
      expect(change.diff.weeks[0].workouts[0]).toEqual(expect.objectContaining({ key: 'c1', change: 'modified' }));
    });

    it('locks completed and past workouts', () => {
      for (const workoutId of ['a1', 'b1']) {
        expect(() =>
          calculator.compute(plan(), workouts(), {
            kind: 'workouts',
            expectedVersion: 2,
            operations: [{ op: 'remove', workoutId }],
          }),
        ).toThrow(expect.objectContaining({ code: 'WORKOUT_LOCKED' }));
      }
    });

    it('moves a workout to another week and updates its week number', () => {
      const change = calculator.compute(plan(), workouts(), {
        kind: 'workouts',
        expectedVersion: 2,
        operations: [{ op: 'move', workoutId: 'b3', date: '2027-03-21' }],
      });

      const patch = change.mutation.updates.find((update) => update.id === 'b3')!.patch;
      expect(patch.weekNumber).toBe(3);
      expect(patch.scheduledAt?.toISOString().slice(0, 10)).toBe('2027-03-21');
      const moved = change.diff.weeks.find((week) => week.weekNumber === 3)!.workouts.find((w) => w.key === 'b3');
      expect(moved?.fields?.weekNumber).toEqual([2, 3]);
    });

    it('adds and removes workouts', () => {
      const change = calculator.compute(plan(), workouts(), {
        kind: 'workouts',
        expectedVersion: 2,
        operations: [
          { op: 'remove', workoutId: 'c2' },
          { op: 'add', date: '2027-03-17', type: 'easy', durationMinutes: 30, distanceKm: 5 },
        ],
      });

      expect(change.mutation.removals).toEqual(['c2']);
      expect(change.mutation.creations).toHaveLength(1);
      expect(change.mutation.creations[0]).toEqual(expect.objectContaining({ weekNumber: 3, type: 'easy' }));
    });

    it('rejects dates outside today..plan end', () => {
      expect(() =>
        calculator.compute(plan(), workouts(), {
          kind: 'workouts',
          expectedVersion: 2,
          operations: [{ op: 'add', date: '2027-03-08', type: 'easy', durationMinutes: 30 }],
        }),
      ).toThrow(expect.objectContaining({ code: 'PLAN_CHANGE_INVALID' }));
    });

    it('is deterministic: preview and apply produce the same mutation', () => {
      const input = {
        kind: 'workouts' as const,
        expectedVersion: 2,
        operations: [{ op: 'update' as const, workoutId: 'c3', distanceKm: 22 }],
      };
      expect(calculator.compute(plan(), workouts(), input).mutation).toEqual(
        calculator.compute(plan(), workouts(), input).mutation,
      );
    });
  });

  describe('schedule', () => {
    it('remaps only upcoming planned workouts from tomorrow and never into the past', () => {
      const change = calculator.compute(plan(), workouts(), {
        kind: 'schedule',
        expectedVersion: 2,
        timezone: 'UTC',
        effectiveFrom: 'tomorrow',
        schedule: { trainingDays: [0, 2, 4, 6], preferredLongRunDay: 6 },
      });

      const touched = new Set([...change.mutation.updates.map((update) => update.id), ...change.mutation.removals]);
      expect(touched.has('a1')).toBe(false);
      expect(touched.has('b1')).toBe(false);
      for (const update of change.mutation.updates) {
        if (update.patch.scheduledAt) {
          expect(update.patch.scheduledAt.toISOString().slice(0, 10) >= '2027-03-11').toBe(true);
        }
      }
      const longRun = change.mutation.updates.find((update) => update.id === 'c3')!;
      expect(longRun.patch.scheduledAt?.toISOString().slice(0, 10)).toBe('2027-03-21');
    });

    it('starts from next week by default and removes sessions that no longer fit', () => {
      const change = calculator.compute(plan(), workouts(), {
        kind: 'schedule',
        expectedVersion: 2,
        schedule: { trainingDays: [2, 6] },
      });

      expect(change.mutation.updates.some((update) => update.id.startsWith('b'))).toBe(false);
      expect(change.mutation.removals).toEqual(['c1']);
      const removed = change.diff.weeks.flatMap((week) => week.workouts).find((workout) => workout.key === 'c1');
      expect(removed?.reason).toBe('NOT_ENOUGH_TRAINING_DAYS');
      expect(change.mutation.config?.schedule).toEqual(expect.objectContaining({ trainingDays: [2, 6] }));
    });
  });

  describe('goal_date', () => {
    it('extends the plan before the taper and keeps started weeks intact', () => {
      const change = calculator.compute(plan(), workouts(), {
        kind: 'goal_date',
        expectedVersion: 2,
        goalTargetDate: '2027-04-10',
      });

      expect(change.resultingEndDate).toBe('2027-04-11');
      expect(change.mutation.endDate).toBe('2027-04-11');
      const touched = [...change.mutation.updates.map((update) => update.id), ...change.mutation.removals];
      expect(touched).not.toContain('a1');
      expect(touched).not.toContain('b2');
      expect(change.mutation.creations.length).toBeGreaterThan(0);
      const race = change.mutation.updates.find((update) => update.id === 'd2')!;
      expect(race.patch.weekNumber).toBe(6);
      expect(change.mutation.weeks).toHaveLength(6);
    });

    it('refuses a date that leaves no room after the current week', () => {
      expect(() =>
        calculator.compute(plan(), workouts(), {
          kind: 'goal_date',
          expectedVersion: 2,
          goalTargetDate: '2027-03-12',
        }),
      ).toThrow(expect.objectContaining({ code: 'PLAN_RESIZE_NOT_POSSIBLE' }));
    });
  });
});
