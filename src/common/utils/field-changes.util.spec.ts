import { diffFields } from './field-changes.util';

describe('diffFields', () => {
  it('returns only the fields whose values differ', () => {
    const before = { distanceKm: 8, type: 'easy', title: null as string | null };
    const after = { distanceKm: 9, type: 'easy', title: 'Long' };

    expect(diffFields(before, after, ['distanceKm', 'type', 'title'])).toEqual({
      distanceKm: { from: 8, to: 9 },
      title: { from: null, to: 'Long' },
    });
  });

  it('compares dates and objects by value and stores dates as ISO strings', () => {
    const before = { at: new Date('2026-10-17T07:00:00.000Z'), quiet: { from: '22:00', to: '07:00' } };
    const after = { at: new Date('2026-10-18T07:00:00.000Z'), quiet: { from: '22:00', to: '07:00' } };

    expect(diffFields(before, after, ['at', 'quiet'])).toEqual({
      at: { from: '2026-10-17T07:00:00.000Z', to: '2026-10-18T07:00:00.000Z' },
    });
  });
});
