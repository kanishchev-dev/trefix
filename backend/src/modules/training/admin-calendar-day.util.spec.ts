import {
  addDaysToDateKey,
  countDaysInclusive,
  resolveLocalRange,
  startOfLocalDay,
  toLocalDateKey,
} from './admin-calendar-day.util';

describe('admin calendar day utils', () => {
  it('resolves local midnight as a UTC instant', () => {
    expect(startOfLocalDay('2026-10-06', 'UTC').toISOString()).toBe('2026-10-06T00:00:00.000Z');
    expect(startOfLocalDay('2026-10-06', 'Europe/Moscow').toISOString()).toBe('2026-10-05T21:00:00.000Z');
    expect(startOfLocalDay('2026-10-06', 'America/New_York').toISOString()).toBe('2026-10-06T04:00:00.000Z');
  });

  it('absorbs DST transitions', () => {
    // Europe/Berlin switches from CEST (+2) to CET (+1) on 2026-10-25.
    expect(startOfLocalDay('2026-10-25', 'Europe/Berlin').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(startOfLocalDay('2026-10-26', 'Europe/Berlin').toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('builds an end-exclusive range covering whole local days', () => {
    const { start, endExclusive } = resolveLocalRange('2026-10-01', '2026-10-31', 'Europe/Moscow');

    expect(start.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-10-31T21:00:00.000Z');
  });

  it('maps an instant to the local calendar day', () => {
    const instant = new Date('2026-10-05T22:30:00.000Z');

    expect(toLocalDateKey(instant, 'UTC')).toBe('2026-10-05');
    expect(toLocalDateKey(instant, 'Europe/Moscow')).toBe('2026-10-06');
  });

  it('does day arithmetic across month boundaries', () => {
    expect(addDaysToDateKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(countDaysInclusive('2026-10-01', '2026-10-31')).toBe(31);
    expect(countDaysInclusive('2026-10-02', '2026-10-01')).toBe(0);
  });
});
