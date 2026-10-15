import { type Effort } from './progress-calculations';
import {
  buildProgressSummary,
  type SummaryInput,
  type SummaryPlanWorkoutSample,
  type SummaryWorkoutSample,
  weekStartOf,
} from './progress-summary';

// 2026-10-15 is a Thursday: the week starts on Monday, October 12.
const TODAY = '2026-10-15';
const NOW = new Date('2026-10-15T12:00:00Z');

function workout(date: string, distanceKm: number, extra: Partial<SummaryWorkoutSample> = {}): SummaryWorkoutSample {
  return {
    id: `w-${date}`,
    date,
    type: 'easy',
    planned: true,
    distanceKm,
    durationMin: distanceKm * 6,
    avgHeartRate: 140,
    elevationM: 30,
    ...extra,
  };
}

function row(date: string, done: boolean, extra: Partial<SummaryPlanWorkoutSample> = {}): SummaryPlanWorkoutSample {
  return {
    id: `p-${date}`,
    date,
    type: 'easy',
    done,
    plannedKm: 6,
    actualKm: done ? 6.2 : null,
    actualDurationMin: done ? 36 : null,
    paceMinSec: null,
    paceMaxSec: null,
    ...extra,
  };
}

function input(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    today: TODAY,
    workouts: [],
    plan: null,
    goal: null,
    efforts: [],
    localDate: (date) => date.toISOString().slice(0, 10),
    now: NOW,
    hrZoneBounds: [130, 145, 160, 172],
    ...overrides,
  };
}

const raceEffort: Effort = {
  id: 'result:r1',
  source: 'result',
  kind: 'race',
  provider: null,
  date: new Date('2026-10-03T12:00:00Z'),
  distanceM: 10000,
  timeSeconds: 2835,
  name: null,
  workoutId: null,
  resultId: 'r1',
  vdot: 45,
};

describe('buildProgressSummary', () => {
  it('starts weeks on Monday', () => {
    expect(weekStartOf(TODAY)).toBe('2026-10-12');
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12');
    expect(weekStartOf('2026-10-18')).toBe('2026-10-12');
  });

  it('keeps an empty history empty', () => {
    const summary = buildProgressSummary(input());
    expect(summary.workouts).toEqual([]);
    expect(summary.firstWorkoutDate).toBeNull();
    expect(summary.years).toEqual([]);
    expect(summary.months).toHaveLength(9);
    expect(summary.longestRun).toBeNull();
    expect(summary.analytics.available).toBe(false);
  });

  it('aggregates months, years and the detailed list, ignoring future days', () => {
    const summary = buildProgressSummary(
      input({
        workouts: [
          workout('2025-05-10', 10),
          workout('2026-02-03', 8),
          workout('2026-09-28', 5),
          workout('2026-10-02', 7),
          workout('2026-10-14', 9, { elevationM: null }),
          workout('2026-10-20', 4),
        ],
      }),
    );
    expect(summary.firstWorkoutDate).toBe('2025-05-10');
    expect(summary.years).toEqual([{ year: 2025, distanceKm: 10, durationMin: 60, elevationM: 30, count: 1 }]);
    expect(summary.months[1]).toMatchObject({ month: 1, distanceKm: 8, count: 1 });
    expect(summary.months[8]).toMatchObject({ month: 8, distanceKm: 5, count: 1 });
    // The month starts before the week here, so the list begins on October 1.
    expect(summary.workouts.map((item) => item.date)).toEqual(['2026-10-14', '2026-10-02']);
    expect(summary.longestRun).toEqual({ distanceKm: 9, date: '2026-10-14', previousKm: 10 });
  });

  it('compares with the same stretch of the previous period', () => {
    const summary = buildProgressSummary(
      input({
        workouts: [
          workout('2026-10-05', 6), // Monday of last week: inside the window
          workout('2026-10-09', 12), // Friday of last week: outside it
          workout('2026-09-10', 8),
          workout('2026-09-20', 20),
          workout('2025-10-01', 5),
          workout('2025-11-01', 30),
        ],
      }),
    );
    expect(summary.comparison.week.totals.distanceKm).toBe(6);
    // September 1–15 only: the run on the 20th is past the same day of the month.
    expect(summary.comparison.month.totals.distanceKm).toBe(8);
    expect(summary.comparison.month.longestKm).toBe(8);
    expect(summary.comparison.year.totals.distanceKm).toBe(5);
    expect(summary.comparison.month.avgPaceSecPerKm).toBe(360);
  });

  it('counts plan completion without calling future workouts missed', () => {
    const rows = [
      row('2026-10-01', true),
      row('2026-10-05', false),
      row('2026-10-13', true, { type: 'tempo', paceMinSec: 290, paceMaxSec: 300 }),
      row('2026-10-15', false),
      row('2026-10-18', false),
      row('2026-11-02', false),
    ];
    const summary = buildProgressSummary(
      input({
        workouts: [
          workout('2026-10-01', 6.2),
          workout('2026-10-13', 6.2),
          workout('2026-10-11', 5, { planned: false }),
        ],
        plan: { startDate: '2026-09-28', totalWeeks: 6, workouts: rows },
      }),
    );
    const plan = summary.plan;
    expect(plan?.currentWeek).toBe(3);
    expect(plan?.execution.week).toEqual({
      done: 1,
      due: 1,
      upcoming: 2,
      plannedKm: 6,
      actualKm: 6.2,
      offPlanKm: 0,
    });
    expect(plan?.execution.month).toMatchObject({ done: 2, due: 3, upcoming: 2, offPlanKm: 5 });
    expect(plan?.execution.sinceStart).toMatchObject({ done: 2, due: 3, upcoming: 3 });

    const missed = summary.workouts.find((item) => item.status === 'missed');
    expect(missed).toMatchObject({ id: null, date: '2026-10-05', distanceKm: 6 });
    expect(summary.analytics.planKeyWorkouts).toEqual([
      { type: 'easy', date: '2026-10-05', planned: { kind: 'distance', km: 6 }, actual: null },
      {
        type: 'tempo',
        date: '2026-10-13',
        planned: { kind: 'pace', fromSec: 290, toSec: 300 },
        actual: { kind: 'pace', sec: 348 },
      },
    ]);
    expect(summary.analytics.regularity[3].days).toEqual(['rest', 'run', 'rest', 'rest', 'future', 'future', 'future']);
    expect(summary.analytics.regularity[2].days[0]).toBe('missed');
  });

  it('shows the best result on the goal distance', () => {
    const summary = buildProgressSummary(
      input({
        efforts: [raceEffort],
        goal: { distanceM: 10000, targetSec: 2700, raceDate: '2026-11-22' },
      }),
    );
    expect(summary.goal).toEqual({
      distanceKm: 10,
      targetSec: 2700,
      raceDate: '2026-11-22',
      best: { seconds: 2835, date: '2026-10-03' },
    });
    expect(summary.recordsThisYear).toBe(1);
    expect(summary.analytics.form['10']).toEqual([{ date: '2026-10-03', seconds: 2835 }]);
  });

  it('opens analytics with enough recent workouts and splits heart rate by zone', () => {
    const dates = ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-08', '2026-10-10', '2026-10-13'];
    const summary = buildProgressSummary(
      input({
        workouts: dates.map((date, index) =>
          workout(date, 6, { avgHeartRate: index < 3 ? 140 : 165, durationMin: 30 }),
        ),
      }),
    );
    expect(summary.analytics.available).toBe(true);
    expect(summary.analytics.heartRateZones).toEqual([0, 50, 0, 50, 0]);
    expect(summary.analytics.avgHeartRate).toBe(153);
    expect(summary.analytics.weeklyKm.at(-1)).toEqual({ weekStart: '2026-10-12', km: 6, partial: true });
  });

  it('leaves heart rate zones empty without measurements', () => {
    const summary = buildProgressSummary(input({ workouts: [workout('2026-10-10', 6, { avgHeartRate: null })] }));
    expect(summary.analytics.heartRateZones).toBeNull();
    expect(summary.analytics.avgHeartRate).toBeNull();
  });

  it('notices a faster easy pace and steady volume', () => {
    const easy = [
      workout('2026-07-05', 6, { durationMin: 37.2 }), // 6:12 /km
      workout('2026-10-05', 6, { durationMin: 35.2 }), // 5:52 /km
    ];
    const weeks = [10, 10.5, 11, 11.8, 12.5, 13].map((km, index) =>
      workout(`2026-${['08-31', '09-07', '09-14', '09-21', '09-28', '10-05'][index]}`, km, { type: 'long_run' }),
    );
    // Week of 2026-10-05 holds both the easy run and the long run: 6 + 13 = 19 km.
    const summary = buildProgressSummary(input({ workouts: [...easy, ...weeks.slice(0, 5)] }));
    const codes = summary.analytics.insights.map((insight) => insight.code);
    expect(codes).toContain('easy_pace_faster');
    expect(summary.analytics.insights[0].params.seconds).toBe(20);
  });
});
