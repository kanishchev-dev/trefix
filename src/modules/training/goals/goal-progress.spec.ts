import { evaluateGoalProgress, type GoalFacts, type GoalWeekFacts } from './goal-progress';

const week = (runs: number, km = runs * 6, minutes = runs * 35): GoalWeekFacts => ({ runs, km, minutes });

function facts(overrides: Partial<GoalFacts> = {}): GoalFacts {
  return {
    goalType: 'prepare_for_race',
    goalStatus: 'active',
    target: {},
    current: {},
    raceDistanceM: 21_097,
    targetTimeSeconds: null,
    targetDate: '2026-11-01',
    today: '2026-10-17',
    weeks: Array.from({ length: 8 }, () => week(3)),
    longestRun: { minutes: 0, km: 0 },
    longestRecentRun: { minutes: 0, km: 0 },
    bestPaceSecPerKm: null,
    race: null,
    plan: { status: 'active', cancelReason: null, adherence: 0.9, elapsedShare: 0.7 },
    thresholdPace: { start: null, latest: null },
    fitness: { start: null, latest: null },
    weightKg: null,
    challenge: null,
    hasWorkouts: true,
    ...overrides,
  };
}

describe('evaluateGoalProgress', () => {
  describe('race goals', () => {
    it('is achieved when the race is run within the target time', () => {
      const result = evaluateGoalProgress(
        facts({ targetTimeSeconds: 6000, race: { timeSeconds: 5950, date: '2026-10-12' } }),
      );
      expect(result).toMatchObject({ category: 'race_event', status: 'achieved', progressPct: 100 });
    });

    it('is achieved by finishing when there is no target time', () => {
      expect(evaluateGoalProgress(facts({ race: { timeSeconds: 7400, date: '2026-10-12' } })).status).toBe('achieved');
    });

    it('is missed when the race was slower than the target', () => {
      const result = evaluateGoalProgress(
        facts({ targetTimeSeconds: 6000, race: { timeSeconds: 6300, date: '2026-10-12' } }),
      );
      expect(result.status).toBe('missed');
      expect(result.current).toBe(6300);
    });

    it('is missed once the grace period after the target date is over without a race', () => {
      expect(evaluateGoalProgress(facts({ targetDate: '2026-10-01' })).status).toBe('missed');
      expect(evaluateGoalProgress(facts({ targetDate: '2026-10-12' })).status).toBe('on_track');
    });

    it('follows plan adherence before the race', () => {
      expect(evaluateGoalProgress(facts()).status).toBe('on_track');
      const lagging = facts({ plan: { status: 'active', cancelReason: null, adherence: 0.5, elapsedShare: 0.7 } });
      expect(evaluateGoalProgress(lagging).status).toBe('at_risk');
    });

    it('is abandoned when the user cancelled the plan, but not when the plan was replaced', () => {
      const cancelled = facts({
        plan: { status: 'cancelled', cancelReason: 'user', adherence: 0.9, elapsedShare: 0.4 },
      });
      expect(evaluateGoalProgress(cancelled).status).toBe('abandoned');
      const replaced = facts({
        plan: { status: 'cancelled', cancelReason: 'replaced', adherence: 0.9, elapsedShare: 0.4 },
      });
      expect(evaluateGoalProgress(replaced).status).toBe('on_track');
    });
  });

  describe('performance goals', () => {
    it('compares the best qualifying pace with the target pace', () => {
      const base = { goalType: 'improve_pace', target: { paceSecondsPerKm: 300 }, current: { paceSecondsPerKm: 330 } };
      expect(evaluateGoalProgress(facts({ ...base, bestPaceSecPerKm: 298 })).status).toBe('achieved');
      const halfway = evaluateGoalProgress(facts({ ...base, bestPaceSecPerKm: 315, targetDate: null }));
      expect(halfway).toMatchObject({ status: 'on_track', progressPct: 50, current: 315, target: 300 });
    });

    it('uses threshold pace improvement when the goal has no numeric target', () => {
      const improved = facts({
        goalType: 'improve_speed',
        thresholdPace: { start: 300, latest: 288 },
        targetDate: null,
      });
      expect(evaluateGoalProgress(improved).status).toBe('achieved');
      const slower = facts({ goalType: 'improve_speed', thresholdPace: { start: 300, latest: 305 }, targetDate: null });
      expect(evaluateGoalProgress(slower).status).toBe('at_risk');
    });

    it('uses fitness for aerobic fitness goals', () => {
      const result = evaluateGoalProgress(
        facts({ goalType: 'improve_aerobic_fitness', fitness: { start: 40, latest: 42 }, targetDate: null }),
      );
      expect(result.status).toBe('achieved');
    });

    it('compares the longest run with an endurance target', () => {
      const base = { goalType: 'build_endurance', target: { continuousDurationMinutes: 90 }, targetDate: null };
      expect(evaluateGoalProgress(facts({ ...base, longestRun: { minutes: 95, km: 15 } })).status).toBe('achieved');
      const short = facts({ ...base, longestRun: { minutes: 60, km: 10 }, longestRecentRun: { minutes: 30, km: 5 } });
      expect(evaluateGoalProgress(short).status).toBe('at_risk');
    });
  });

  describe('habit goals', () => {
    it('needs the weekly target in 3 of the last 4 weeks', () => {
      const base = { goalType: 'build_consistency', target: { runsPerWeek: 4 }, targetDate: null, plan: null };
      const weeks = [week(4), week(4), week(2), week(4), week(1), week(1), week(1), week(1)];
      expect(evaluateGoalProgress(facts({ ...base, weeks })).status).toBe('achieved');
      const lagging = [week(1), week(1), week(4), week(4), week(4), week(4), week(4), week(4)];
      expect(evaluateGoalProgress(facts({ ...base, weeks: lagging })).status).toBe('at_risk');
    });

    it('defaults to regular runs four weeks in a row without a target', () => {
      const base = { goalType: 'start_running', targetDate: null, plan: null };
      expect(evaluateGoalProgress(facts(base)).status).toBe('achieved');
      const gap = [week(2), week(2), week(0), week(2), week(2), week(2), week(2), week(2)];
      expect(evaluateGoalProgress(facts({ ...base, weeks: gap })).status).toBe('on_track');
    });

    it('has no data before the first workout and without a plan', () => {
      const result = evaluateGoalProgress(
        facts({ goalType: 'start_running', targetDate: null, plan: null, hasWorkouts: false, weeks: [] }),
      );
      expect(result.status).toBe('no_data');
    });
  });

  describe('lifestyle goals', () => {
    it('compares the current weight with the target weight', () => {
      const base = { goalType: 'lose_weight', target: { weightKg: 75 }, current: { weightKg: 85 }, targetDate: null };
      expect(evaluateGoalProgress(facts({ ...base, weightKg: 74.5 })).status).toBe('achieved');
      expect(evaluateGoalProgress(facts({ ...base, weightKg: 80 }))).toMatchObject({
        status: 'on_track',
        progressPct: 50,
      });
    });

    it('needs the habit for 8 weeks to maintain fitness', () => {
      const base = { goalType: 'maintain_fitness', targetDate: null };
      expect(evaluateGoalProgress(facts(base)).status).toBe('achieved');
      const weeks = [week(3), week(3), week(3), week(3), week(3), week(3), week(3), week(1)];
      expect(evaluateGoalProgress(facts({ ...base, weeks })).status).toBe('on_track');
    });
  });

  it('compares challenge progress with the elapsed share of its period', () => {
    const base = { goalType: 'complete_challenge', target: { challengeTargetValue: 100 }, targetDate: null };
    expect(evaluateGoalProgress(facts({ ...base, challenge: { value: 100, elapsedShare: 0.8 } })).status).toBe(
      'achieved',
    );
    expect(evaluateGoalProgress(facts({ ...base, challenge: { value: 40, elapsedShare: 0.8 } })).status).toBe(
      'at_risk',
    );
    expect(evaluateGoalProgress(facts({ ...base, challenge: { value: 75, elapsedShare: 0.8 } })).status).toBe(
      'on_track',
    );
  });

  it('reaches a custom goal by completing its plan', () => {
    const completed = facts({
      goalType: 'custom',
      targetDate: null,
      plan: { status: 'completed', cancelReason: null, adherence: 0.8, elapsedShare: 1 },
    });
    expect(evaluateGoalProgress(completed).status).toBe('achieved');
  });
});
