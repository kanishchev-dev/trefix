import { maxSessionsPerWeek, reconcileSchedule, type ScheduleState } from './schedule-rules';

const base: ScheduleState = {
  experienceLevel: 'advanced',
  availableTrainingDays: ['monday', 'wednesday', 'friday'],
  sessionsPerWeek: 3,
  allowDoubles: false,
};
const none = { sessionsPerWeek: false, allowDoubles: false };

describe('schedule rules', () => {
  it('limits sessions by days, or twice the days with doubles, never above 7', () => {
    expect(maxSessionsPerWeek(3, false)).toBe(3);
    expect(maxSessionsPerWeek(3, true)).toBe(6);
    expect(maxSessionsPerWeek(5, true)).toBe(7);
  });

  it('rejects more sessions than days when the user sets them', () => {
    expect(() => reconcileSchedule({ ...base, sessionsPerWeek: 4 }, { ...none, sessionsPerWeek: true })).toThrow(
      expect.objectContaining({ code: 'ATHLETE_SESSIONS_EXCEED_DAYS' }) as unknown as Error,
    );
  });

  it('accepts up to twice the days with doubles', () => {
    const result = reconcileSchedule(
      { ...base, sessionsPerWeek: 6, allowDoubles: true },
      { sessionsPerWeek: true, allowDoubles: true },
    );
    expect(result.sessionsPerWeek).toBe(6);
  });

  it('lowers sessions when a day is removed', () => {
    const result = reconcileSchedule({ ...base, availableTrainingDays: ['monday', 'friday'] }, none);
    expect(result.sessionsPerWeek).toBe(2);
  });

  it('rejects doubles below the advanced level', () => {
    expect(() =>
      reconcileSchedule(
        { ...base, experienceLevel: 'intermediate', allowDoubles: true },
        { ...none, allowDoubles: true },
      ),
    ).toThrow(expect.objectContaining({ code: 'ATHLETE_DOUBLES_NOT_ALLOWED' }) as unknown as Error);
  });

  it('resets doubles and lowers sessions when the level goes down', () => {
    const result = reconcileSchedule(
      { ...base, experienceLevel: 'intermediate', allowDoubles: true, sessionsPerWeek: 6 },
      none,
    );
    expect(result).toMatchObject({ allowDoubles: false, sessionsPerWeek: 3 });
  });
});
