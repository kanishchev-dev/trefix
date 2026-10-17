import { dateRange, deltaPct, median, mondayOf, resolveScope, share, weekRange } from './analytics-period';

describe('analytics period', () => {
  it('resolves the current and previous period in the requested timezone', () => {
    // 22:30 UTC on Oct 16 is already Oct 17 in Moscow.
    const scope = resolveScope('7d', 'Europe/Moscow', false, new Date('2026-10-16T22:30:00Z'));
    expect(scope).toMatchObject({
      today: '2026-10-17',
      from: '2026-10-11',
      to: '2026-10-17',
      prevFrom: '2026-10-04',
      prevTo: '2026-10-10',
      bucket: 'day',
      days: 7,
    });
  });

  it('switches the yearly period to weekly buckets', () => {
    expect(resolveScope('12m', 'UTC', false, new Date('2026-10-17T10:00:00Z')).bucket).toBe('week');
  });

  it('computes the change against the previous period', () => {
    expect(deltaPct(110, 100)).toBe(10);
    expect(deltaPct(5, 0)).toBeNull();
    expect(deltaPct(90, 120)).toBe(-25);
  });

  it('builds day and week ranges', () => {
    expect(dateRange('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(weekRange('2026-10-14', '2026-10-27')).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('computes shares and medians', () => {
    expect(share(1, 3)).toBe(33.3);
    expect(share(1, 0)).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
