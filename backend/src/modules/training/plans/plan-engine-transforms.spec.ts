import { type RelativeWeek, type RelativeWorkout, TrainingEngine } from '../training.engine';

/** Plan lifecycle transforms of the engine; fixed dates, no system clock. */
describe('TrainingEngine plan lifecycle transforms', () => {
  const engine = new TrainingEngine();

  const makeWorkout = (overrides: Partial<RelativeWorkout> = {}): RelativeWorkout => ({
    key: 'w1-1',
    dayOfWeek: 2,
    orderInWeek: 1,
    type: 'easy',
    phase: 'base',
    durationMinutes: 40,
    distanceKm: 6,
    target: { paceMinSecondsPerKm: 342, paceMaxSecondsPerKm: 370, zone: 'Z2' },
    steps: [],
    ...overrides,
  });

  const makeWeek = (weekNumber: number, workouts: RelativeWorkout[]): RelativeWeek => ({
    weekNumber,
    phase: weekNumber <= 2 ? 'base' : weekNumber >= 15 ? 'taper' : 'build',
    weeklyLoadTarget: 40,
    workouts,
  });

  const basePlan = (): RelativeWeek[] => [
    makeWeek(1, [
      makeWorkout({ key: 'w1-1', dayOfWeek: 0, orderInWeek: 1, type: 'easy' }),
      makeWorkout({ key: 'w1-2', dayOfWeek: 3, orderInWeek: 2, type: 'tempo', distanceKm: 8, durationMinutes: 45 }),
      makeWorkout({ key: 'w1-3', dayOfWeek: 5, orderInWeek: 3, type: 'long_run', distanceKm: 14, durationMinutes: 90 }),
    ]),
    makeWeek(2, [
      makeWorkout({ key: 'w2-1', dayOfWeek: 1, orderInWeek: 1, type: 'easy' }),
      makeWorkout({ key: 'w2-2', dayOfWeek: 5, orderInWeek: 2, type: 'long_run', distanceKm: 15, durationMinutes: 95 }),
    ]),
    makeWeek(3, [
      makeWorkout({ key: 'w3-1', dayOfWeek: 2, orderInWeek: 1, type: 'tempo', distanceKm: 8, durationMinutes: 45 }),
      makeWorkout({
        key: 'w3-2',
        dayOfWeek: 5,
        orderInWeek: 2,
        type: 'long_run',
        distanceKm: 16,
        durationMinutes: 100,
      }),
    ]),
  ];

  describe('materializeWeeks', () => {
    it('maps workouts onto real dates starting from a Monday start date', () => {
      // 2027-03-01 is a Monday.
      const result = engine.materializeWeeks(basePlan(), new Date('2027-03-01T00:00:00Z'));

      expect(result.startDate).toBe('2027-03-01');
      expect(result.endDate).toBe('2027-03-21');
      expect(result.totalWeeks).toBe(3);
      expect(result.dropped).toEqual([]);

      const first = result.workouts[0];
      expect(first.key).toBe('w1-1');
      expect(first.scheduledAt.toISOString().slice(0, 10)).toBe('2027-03-01');

      const longRun = result.workouts.find((workout) => workout.type === 'long_run');
      // dayOfWeek 5 = Saturday of the week starting Monday 2027-03-01.
      expect(longRun?.scheduledAt.toISOString().slice(0, 10)).toBe('2027-03-06');
    });

    it('relocates first-week workouts scheduled before the start date', () => {
      // 2027-03-03 is a Wednesday (index 2): the Monday workout must move.
      const weeks = [
        makeWeek(1, [
          makeWorkout({ key: 'w1-1', dayOfWeek: 0, orderInWeek: 1 }),
          makeWorkout({ key: 'w1-2', dayOfWeek: 3, orderInWeek: 2 }),
        ]),
      ];

      const result = engine.materializeWeeks(weeks, new Date('2027-03-03T00:00:00Z'));
      expect(result.dropped).toEqual([]);
      const keys = result.workouts.map((workout) => workout.key);
      expect(keys).toContain('w1-1');
      // The relocated workout lands inside the same week, after the start date.
      const relocated = result.workouts.find((workout) => workout.key === 'w1-1')!;
      expect(relocated.scheduledAt.getTime()).toBeGreaterThanOrEqual(new Date('2027-03-03T00:00:00Z').getTime());
    });

    it('keeps the same week for all workouts of week one', () => {
      const weeks = [makeWeek(1, [makeWorkout({ key: 'w1-1', dayOfWeek: 6 })])];
      const result = engine.materializeWeeks(weeks, new Date('2027-03-03T00:00:00Z'));

      const scheduled = result.workouts[0].scheduledAt;
      const diffDays = (scheduled.getTime() - new Date('2027-03-03T00:00:00Z').getTime()) / 86_400_000;
      expect(diffDays).toBeGreaterThanOrEqual(0);
      expect(diffDays).toBeLessThan(7);
    });
  });

  describe('toRelativeWeeks', () => {
    it('converts a generated plan into stable relative keys', () => {
      const generated = engine.generatePlan(
        {
          id: 'athlete-1',
          userId: 'user-1',
          age: null,
          sex: null,
          heightCm: null,
          weightKg: null,
          experienceLevel: 'intermediate',
          weeklyMileageKm: 40,
          sessionsPerWeek: 4,
          allowDoubles: false,
          recentRaceResults: [],
          preferredTrainingDays: [],
          availableTrainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
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
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'goal-1',
          athleteId: 'athlete-1',
          type: 'prepare_for_race',
          payload: { target: { distanceMeters: 42195, finishTimeSec: 12600 } },
          raceDistance: 'marathon',
          targetTimeSeconds: 12600,
          targetDate: '2026-06-14',
          priority: 5,
          status: 'active',
          notes: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          fitness: 50,
          fatigue: 40,
          form: 10,
          weeklyLoad: 300,
          acuteLoad: 300,
          chronicLoad: 300,
          recoveryScore: 70,
          thresholdPaceSecondsPerKm: 285,
          thresholdHeartRate: 168,
          vo2max: 50,
          confidence: 0.7,
          source: 'test',
        },
        new Date('2026-03-02T00:00:00Z'),
        { totalWeeks: 6 },
      );

      const relative = engine.toRelativeWeeks(generated);
      expect(relative).toHaveLength(6);
      expect(relative[0].weekNumber).toBe(1);
      expect(relative[0].workouts[0].key).toBe('w1-1');
      expect(relative[0].workouts.every((workout) => workout.dayOfWeek >= 0 && workout.dayOfWeek <= 6)).toBe(true);

      // Round-trip: materializing the relative weeks reproduces the dates.
      const rematerialized = engine.materializeWeeks(relative, new Date('2026-03-02T00:00:00Z'));
      expect(rematerialized.startDate).toBe('2026-03-02');
      expect(rematerialized.workouts).toHaveLength(generated.workouts.length);
    });
  });

  describe('extractFinalVersion', () => {
    it('rebuilds relative weeks from plan workouts including cancelled ones', () => {
      const plan = { startDate: '2026-03-02', endDate: '2026-03-15' };
      const workouts = [
        {
          weekNumber: 1,
          orderInWeek: 1,
          scheduledAt: new Date('2026-03-02T09:00:00Z'),
          type: 'easy',
          phase: 'base',
          durationMinutes: 40,
          distanceKm: 6,
          target: {},
          steps: [],
        },
        {
          weekNumber: 1,
          orderInWeek: 2,
          scheduledAt: new Date('2026-03-04T09:00:00Z'),
          type: 'long_run',
          phase: 'base',
          durationMinutes: 90,
          distanceKm: 14,
          target: {},
          steps: [],
        },
        {
          weekNumber: 2,
          orderInWeek: 1,
          scheduledAt: new Date('2026-03-09T09:00:00Z'),
          type: 'tempo',
          phase: 'build',
          durationMinutes: 45,
          distanceKm: 8,
          target: {},
          steps: [],
        },
      ];

      const relative = engine.extractFinalVersion(plan, workouts);
      expect(relative).toHaveLength(2);
      expect(relative[0].workouts.map((workout) => workout.type)).toEqual(['easy', 'long_run']);
      expect(relative[1].workouts[0].type).toBe('tempo');
    });

    it('returns an empty structure for a plan without a start date', () => {
      expect(engine.extractFinalVersion({ startDate: null, endDate: null }, [])).toEqual([]);
    });
  });

  describe('retargetIntensity', () => {
    it('recomputes pace ranges from the new threshold and keeps rest untouched', () => {
      const weeks = basePlan();
      weeks[0].workouts.push(makeWorkout({ key: 'w1-4', type: 'rest', dayOfWeek: 6, orderInWeek: 4 }));

      const retargeted = engine.retargetIntensity(weeks, { thresholdPaceSecondsPerKm: 300 });

      const tempo = retargeted[0].workouts.find((workout) => workout.type === 'tempo')!;
      expect(tempo.target.paceMinSecondsPerKm).toBe(Math.round(300 * 0.98));
      expect(tempo.target.paceMaxSecondsPerKm).toBe(Math.round(300 * 1.03));

      const rest = retargeted[0].workouts.find((workout) => workout.type === 'rest')!;
      expect(rest.target).toEqual(weeks[0].workouts[3].target);
    });

    it('derives the threshold from recentResult when no explicit pace is given', () => {
      const threshold = engine.resolveThresholdFromMetrics({
        recentResult: { distance: 'marathon', timeSeconds: 12600, date: '2026-09-20' },
      });
      expect(threshold).toBe(Math.round(12600 / 42.195));
    });

    it('prefers the explicit threshold over the result', () => {
      expect(
        engine.resolveThresholdFromMetrics({
          thresholdPaceSecondsPerKm: 280,
          recentResult: { distance: 'marathon', timeSeconds: 12600, date: '2026-09-20' },
        }),
      ).toBe(280);
    });
  });

  describe('scaleVolume', () => {
    it('clamps the scale factor into the safe range', () => {
      const { adjustments } = engine.scaleVolume(basePlan(), 2.5, { weeklyMileageKm: 50 });
      const scale = adjustments.find((adjustment) => adjustment.code === 'VOLUME_SCALED');
      expect(scale?.params?.k).toBe(1.3);
    });

    it('scales easy workouts but keeps race workouts untouched', () => {
      const weeks = basePlan();
      weeks[1].workouts.push(
        makeWorkout({ key: 'w2-3', dayOfWeek: 6, orderInWeek: 3, type: 'race', distanceKm: 10, durationMinutes: 50 }),
      );

      const { weeks: scaled } = engine.scaleVolume(weeks, 0.8, {});
      const easy = scaled[0].workouts.find((workout) => workout.type === 'easy')!;
      expect(easy.distanceKm).toBeCloseTo(4.8, 1);

      const race = scaled[1].workouts.find((workout) => workout.type === 'race')!;
      expect(race.distanceKm).toBe(10);
      expect(race.durationMinutes).toBe(50);
    });

    it('caps the long run by the athlete longest run', () => {
      const weeks = [
        makeWeek(1, [makeWorkout({ key: 'w1-1', type: 'long_run', distanceKm: 30, durationMinutes: 180 })]),
      ];
      const { weeks: scaled, adjustments } = engine.scaleVolume(weeks, 1.0, { longestRunKm: 20 });

      const longRun = scaled[0].workouts[0];
      expect(longRun.distanceKm).toBeLessThanOrEqual(Math.max(20 * 1.15, 23));
      expect(adjustments.some((adjustment) => adjustment.code === 'LONG_RUN_CAPPED')).toBe(true);
    });

    it('keeps interval work segments while scaling warm-up and cool-down', () => {
      const weeks = [
        makeWeek(1, [
          makeWorkout({
            key: 'w1-1',
            type: 'interval',
            distanceKm: 10,
            durationMinutes: 50,
            steps: [
              { type: 'warmup', durationMinutes: 10 },
              { type: 'interval', durationMinutes: 30, repetitions: 5 },
              { type: 'cooldown', durationMinutes: 10 },
            ],
          }),
        ]),
      ];

      const { weeks: scaled } = engine.scaleVolume(weeks, 0.8, {});
      const interval = scaled[0].workouts[0];
      expect(interval.steps[0].durationMinutes).toBe(8);
      expect(interval.steps[1].durationMinutes).toBe(30);
      expect(interval.steps[2].durationMinutes).toBe(8);
    });
  });

  describe('remapSchedule', () => {
    it('moves workouts to the new training days and preserves the order', () => {
      const weeks = basePlan();
      const { weeks: remapped } = engine.remapSchedule(weeks, { trainingDays: [0, 2, 4] }, 1);

      expect(remapped[0].workouts.map((workout) => workout.dayOfWeek)).toEqual([0, 2, 4]);
      // Long run lands on the last available day when no preference is given.
      expect(remapped[0].workouts[2].type).toBe('long_run');
    });

    it('removes the least valuable workouts when days are fewer than sessions', () => {
      const weeks = [
        makeWeek(2, [
          makeWorkout({ key: 'w2-1', dayOfWeek: 0, type: 'recovery' }),
          makeWorkout({ key: 'w2-2', dayOfWeek: 2, type: 'easy' }),
          makeWorkout({ key: 'w2-3', dayOfWeek: 4, type: 'long_run' }),
        ]),
      ];

      const { weeks: remapped, removed } = engine.remapSchedule(weeks, { trainingDays: [1, 5] }, 1);
      expect(remapped[0].workouts).toHaveLength(2);
      expect(removed).toHaveLength(1);
      expect(removed[0].key).toBe('w2-1');
      expect(removed[0].reason).toBe('NOT_ENOUGH_TRAINING_DAYS');
    });

    it('leaves passed weeks untouched', () => {
      const weeks = basePlan();
      const before: RelativeWeek = JSON.parse(JSON.stringify(weeks[0]));
      engine.remapSchedule(weeks, { trainingDays: [4, 5, 6] }, 2);
      expect(weeks[0].workouts.map((workout) => workout.dayOfWeek)).toEqual(
        before.workouts.map((workout) => workout.dayOfWeek),
      );
    });

    it('places the long run on the preferred day', () => {
      const weeks = basePlan();
      const { weeks: remapped } = engine.remapSchedule(weeks, { trainingDays: [0, 2, 5], preferredLongRunDay: 5 }, 1);
      const longRun = remapped[0].workouts.find((workout) => workout.type === 'long_run')!;
      expect(longRun.dayOfWeek).toBe(5);
    });
  });

  describe('resizeToTargetDate', () => {
    it('extends the plan by inserting weeks before the taper', () => {
      const weeks = [
        makeWeek(1, [makeWorkout({ key: 'w1-1', type: 'easy', distanceKm: 8, durationMinutes: 40 })]),
        makeWeek(2, [makeWorkout({ key: 'w2-1', type: 'tempo', distanceKm: 10, durationMinutes: 50 })]),
        makeWeek(3, [makeWorkout({ key: 'w3-1', type: 'easy', distanceKm: 6, durationMinutes: 40 })]),
        makeWeek(4, [makeWorkout({ key: 'w4-1', type: 'race', distanceKm: 10, durationMinutes: 50 })]),
      ];
      weeks[2].phase = 'taper';
      weeks[3].phase = 'race';

      const resized = engine.resizeToTargetDate(weeks, 1, 5);
      expect(resized).toHaveLength(5);
      expect(resized[3].phase).toBe('taper');
      expect(resized[4].phase).toBe('race');
    });

    it('shortens the plan from the build remainder keeping taper and race', () => {
      const weeks = [
        makeWeek(1, [makeWorkout({ key: 'w1-1', type: 'easy' })]),
        makeWeek(2, [makeWorkout({ key: 'w2-1', type: 'tempo' })]),
        makeWeek(3, [makeWorkout({ key: 'w3-1', type: 'easy' })]),
        makeWeek(4, [makeWorkout({ key: 'w4-1', type: 'tempo' })]),
        makeWeek(5, [makeWorkout({ key: 'w5-1', type: 'race' })]),
      ];
      weeks[3].phase = 'taper';
      weeks[4].phase = 'race';

      const resized = engine.resizeToTargetDate(weeks, 1, 4);
      expect(resized).toHaveLength(4);
      // The last build week is removed; earlier weeks keep their phases.
      expect(resized.map((week) => week.phase)).toEqual(['base', 'base', 'taper', 'race']);
    });

    it('refuses a reduction below the minimum before taper', () => {
      const weeks = [
        makeWeek(1, [makeWorkout({ key: 'w1-1', type: 'easy' })]),
        makeWeek(2, [makeWorkout({ key: 'w2-1', type: 'tempo' })]),
        makeWeek(3, [makeWorkout({ key: 'w3-1', type: 'easy' })]),
        makeWeek(4, [makeWorkout({ key: 'w4-1', type: 'race' })]),
      ];
      weeks[2].phase = 'taper';
      weeks[3].phase = 'race';

      expect(() => engine.resizeToTargetDate(weeks, 1, 2)).toThrow('PLAN_RESIZE_NOT_POSSIBLE');
    });

    it('never touches passed weeks', () => {
      const weeks = basePlan();
      const passedWeek = JSON.parse(JSON.stringify(weeks[0]));
      const resized = engine.resizeToTargetDate(weeks, 2, 3);
      expect(resized[0]).toEqual(passedWeek);
    });
  });

  describe('diffPlans', () => {
    it('reports added, removed and modified workouts with a summary', () => {
      const before = basePlan();
      const after: RelativeWeek[] = JSON.parse(JSON.stringify(basePlan()));

      // Modify a distance.
      after[0].workouts[0].distanceKm = 7;
      // Remove a workout.
      after[1].workouts = after[1].workouts.filter((workout) => workout.key !== 'w2-2');
      // Add a workout.
      after[2].workouts.push(makeWorkout({ key: 'w3-3', dayOfWeek: 0, orderInWeek: 3, type: 'recovery' }));

      const diff = engine.diffPlans(
        before,
        after,
        { thresholdPaceSecondsPerKm: 285 },
        { thresholdPaceSecondsPerKm: 278 },
      );

      const week1 = diff.weeks.find((week) => week.weekNumber === 1)!;
      const modified = week1.workouts.find((workout) => workout.key === 'w1-1');
      expect(modified?.change).toBe('modified');
      expect(modified?.fields?.distanceKm).toEqual([6, 7]);

      const week2 = diff.weeks.find((week) => week.weekNumber === 2)!;
      expect(week2.workouts.find((workout) => workout.key === 'w2-2')?.change).toBe('removed');

      const week3 = diff.weeks.find((week) => week.weekNumber === 3)!;
      expect(week3.workouts.find((workout) => workout.key === 'w3-3')?.change).toBe('added');

      expect(diff.summary.totalWeeks).toEqual({ before: 3, after: 3 });
      expect(diff.summary.thresholdPace).toEqual({ before: 285, after: 278 });
    });

    it('returns an empty weeks list for identical plans', () => {
      const plan = basePlan();
      const diff = engine.diffPlans(plan, JSON.parse(JSON.stringify(plan)));
      expect(diff.weeks).toEqual([]);
    });
  });

  describe('stable keys', () => {
    it('keeps workout keys when the schedule is remapped', () => {
      const { weeks: remapped } = engine.remapSchedule(basePlan(), { trainingDays: [1, 3, 6] }, 1);
      expect(remapped[0].workouts.map((workout) => workout.key).sort()).toEqual(['w1-1', 'w1-2', 'w1-3']);
    });

    it('keeps existing keys on resize and derives keys for inserted weeks', () => {
      const weeks = basePlan();
      weeks[2].phase = 'taper';
      const resized = engine.resizeToTargetDate(weeks, 1, 4);
      const keys = resized.flatMap((week) => week.workouts.map((workout) => workout.key));
      expect(keys).toEqual(expect.arrayContaining(['w1-1', 'w2-1', 'w3-1', 'w2-1~x1']));
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('reports a workout moved to another week as one modified entry', () => {
      const before = basePlan();
      const after: RelativeWeek[] = JSON.parse(JSON.stringify(before));
      const [moved] = after[0].workouts.splice(0, 1);
      after[1].workouts.push(moved);

      const diff = engine.diffPlans(before, after);
      const entries = diff.weeks.flatMap((week) => week.workouts).filter((workout) => workout.key === 'w1-1');
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(expect.objectContaining({ change: 'modified', fields: { weekNumber: [1, 2] } }));
    });
  });

  describe('materializeWeeks continuation', () => {
    it('does not relocate first-week workouts when continuing a running plan', () => {
      const weeks = [makeWeek(1, [makeWorkout({ key: 'w1-1', dayOfWeek: 0 })])];
      // Wednesday start: Monday of the same plan week is 5 days later.
      const result = engine.materializeWeeks(weeks, new Date('2027-03-03T00:00:00Z'), { relocateFirstWeek: false });
      expect(result.workouts[0].scheduledAt.toISOString().slice(0, 10)).toBe('2027-03-08');
    });

    it('never relocates into days before the start weekday', () => {
      const weeks = [
        makeWeek(1, [
          makeWorkout({ key: 'w1-1', dayOfWeek: 0, orderInWeek: 1 }),
          makeWorkout({ key: 'w1-2', dayOfWeek: 1, orderInWeek: 2 }),
        ]),
      ];
      // Saturday start (index 5): only Saturday and Sunday are available.
      const result = engine.materializeWeeks(weeks, new Date('2027-03-06T00:00:00Z'));
      for (const workout of result.workouts) {
        expect(workout.scheduledAt.getTime()).toBeGreaterThanOrEqual(new Date('2027-03-06T00:00:00Z').getTime());
      }
    });
  });

  describe('rebuildWorkoutTarget', () => {
    it('builds the target of the new type from the threshold recovered from the old target', () => {
      const oldTarget = engine.rebuildWorkoutTarget({
        type: 'easy',
        durationMinutes: 40,
        thresholdPaceSecondsPerKm: 300,
      });
      expect(engine.estimateThresholdFromTarget('easy', oldTarget.target)).toBe(300);

      const rebuilt = engine.rebuildWorkoutTarget({
        type: 'threshold',
        durationMinutes: 50,
        previousType: 'easy',
        previousTarget: oldTarget.target,
      });
      expect(rebuilt.target.zone).toBe('Z4');
      expect(rebuilt.target.paceMinSecondsPerKm).toBe(Math.round(300 * 0.95));
      expect(rebuilt.steps.length).toBeGreaterThan(0);
    });

    it('maps faster paces to higher heart rates', () => {
      const weeks = [
        makeWeek(1, [makeWorkout({ type: 'interval', target: { heartRateMinBpm: 1, heartRateMaxBpm: 1 } })]),
      ];
      const [week] = engine.retargetIntensity(weeks, { thresholdPaceSecondsPerKm: 300, thresholdHeartRate: 170 });
      const target = week.workouts[0].target;
      expect(Number(target.heartRateMinBpm)).toBeGreaterThan(170);
      expect(Number(target.heartRateMaxBpm)).toBeGreaterThan(Number(target.heartRateMinBpm));
    });
  });
});
