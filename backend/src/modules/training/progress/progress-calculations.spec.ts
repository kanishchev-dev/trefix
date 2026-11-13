import type { GoalView } from '../interfaces/training-views.interface';
import {
  achievementsFor,
  bestRecords,
  capabilitiesAt,
  dynamicsFor,
  type Effort,
  formAt,
  timeForDistance,
  toEfforts,
  vdotAt,
  type WorkoutSample,
} from './progress-calculations';
import { goalProgress } from './progress-goal';

const DAY = 86_400_000;
const now = new Date('2026-10-09T12:00:00Z');
const daysAgo = (days: number): Date => new Date(now.getTime() - days * DAY);

const workout = (overrides: Partial<WorkoutSample>): WorkoutSample => ({
  id: Math.random().toString(36).slice(2),
  date: daysAgo(1),
  distanceKm: 10,
  durationMinutes: 50,
  averageHeartRate: 150,
  type: 'easy',
  title: null,
  provider: null,
  planId: null,
  excludeFromRecords: false,
  load: 50,
  ...overrides,
});

describe('progress calculations', () => {
  it('takes the best VDOT of the window and ignores excluded or broken tracks', () => {
    const efforts = toEfforts(
      [
        workout({ distanceKm: 10, durationMinutes: 40, date: daysAgo(10) }),
        workout({ distanceKm: 10, durationMinutes: 55, date: daysAgo(5) }),
        workout({ distanceKm: 10, durationMinutes: 30, date: daysAgo(3), excludeFromRecords: true }),
        workout({ distanceKm: 10, durationMinutes: 15, date: daysAgo(2) }), // 1:30 /km — broken
        workout({ distanceKm: 10, durationMinutes: 35, date: daysAgo(120) }), // outside 90 days
      ],
      [],
    );
    const { vdot, qualifying } = vdotAt(efforts, now);
    expect(vdot).toBeCloseTo(51.9, 0);
    expect(qualifying).toHaveLength(1);
  });

  it('scales a longer workout to the record distance and requires exact manual results', () => {
    const efforts: Effort[] = toEfforts(
      [workout({ distanceKm: 10.4, durationMinutes: 52 })],
      [{ id: 'r1', date: daysAgo(30), distanceM: 5000, timeSeconds: 1361, kind: 'race', name: 'Лужники' }],
    );
    expect(
      timeForDistance(
        efforts.find((e) => e.source === 'workout')!,
        10000,
      ),
    ).toBe(3000);
    expect(
      timeForDistance(
        efforts.find((e) => e.source === 'result')!,
        10000,
      ),
    ).toBeNull();
    const records = bestRecords(efforts, now);
    expect(records['5k']?.seconds).toBe(1361);
    expect(records['10k']?.isNew).toBe(true);
    expect(records['5k']?.isNew).toBe(false);
  });

  it('computes form like the training engine', () => {
    const loads = [
      { date: daysAgo(1), load: 70 },
      { date: daysAgo(10), load: 60 },
      { date: daysAgo(50), load: 100 },
    ];
    expect(formAt(loads, now)).toEqual({ fitness: 22, fatigue: 70, form: -48 });
  });

  it('builds capabilities on a 0–100 scale', () => {
    const workouts = [
      workout({ distanceKm: 25, durationMinutes: 140, date: daysAgo(3) }),
      workout({ date: daysAgo(10) }),
    ];
    const caps = capabilitiesAt(
      {
        workouts,
        efforts: toEfforts(workouts, []),
        loads: [],
        sessionsPerWeek: 3,
        planAdherence: { planned: 8, completed: 6 },
      },
      now,
    );
    // 35 km over 4 weeks (8.75 km/week) and a 25 km long run: 7 + 50.
    expect(caps.endurance).toBe(57);
    expect(caps.consistency).toBe(75);
    expect(caps.recovery).toBeNull();
    expect(caps.threshold).not.toBeNull();
  });

  it('buckets dynamics by week and compares with the previous period', () => {
    const workouts = [
      workout({ date: daysAgo(2) }),
      workout({ date: daysAgo(9) }),
      workout({ date: daysAgo(40), distanceKm: 5 }),
    ];
    const series = dynamicsFor(workouts, daysAgo(28), now, 'week', 'distance');
    expect(series.points.length).toBeGreaterThanOrEqual(4);
    expect(series.points.at(-1)?.value).toBe(10);
    expect(series.changePercent).toBeGreaterThan(0);
  });

  it('lists the longest workout, streaks and distance milestones', () => {
    const workouts = Array.from({ length: 12 }, (_, index) =>
      workout({ date: daysAgo(index * 3), distanceKm: index === 4 ? 21.4 : 10 }),
    );
    const achievements = achievementsFor({
      allWorkouts: workouts,
      records: {},
      sessionsPerWeek: 2,
      from: daysAgo(90),
      now,
    });
    expect(achievements.find((entry) => entry.kind === 'longest_run')?.value).toBe(21.4);
    expect(achievements.find((entry) => entry.kind === 'streak')?.value).toBeGreaterThanOrEqual(2);
    expect(achievements.find((entry) => entry.kind === 'total_distance')?.value).toBe(100);
  });

  it('forecasts a race goal and its status', () => {
    const goal = {
      id: 'g1',
      type: 'improve_race_result',
      payload: { target: { distanceMeters: 21097.5, finishTimeSec: 6000 } },
      raceDistance: 'half_marathon',
      targetTimeSeconds: null,
      targetDate: '2026-11-22',
    } as unknown as GoalView;
    const fast = toEfforts([workout({ distanceKm: 10, durationMinutes: 40, date: daysAgo(5) })], []);
    const result = goalProgress(goal, fast, daysAgo(90), now);
    expect(result.forecastSeconds).toBeLessThan(6000);
    expect(result.status).toBe('on_track');
    expect(goalProgress(goal, [], daysAgo(90), now).status).toBe('no_data');
  });
});
