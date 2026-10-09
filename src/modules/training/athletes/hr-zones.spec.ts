import { calculateHrZones, estimateMaxHeartRate, heartRateRangeForZone, isValidCustomZones } from './hr-zones';

describe('hr-zones', () => {
  const base = { restingHeartRate: 52, maxHeartRate: 190, thresholdHeartRate: 170, customUpperBounds: null };

  it('builds max-HR zones at 60/70/80/90%', () => {
    const { zones, unavailableReason } = calculateHrZones({ ...base, method: 'max_hr' });
    expect(unavailableReason).toBeNull();
    expect(zones?.map((zone) => zone.max)).toEqual([114, 133, 152, 171, 190]);
    expect(zones?.[0].min).toBeNull();
    expect(zones?.[4].min).toBe(171);
  });

  it('builds threshold zones at 81/89/93/99% of LTHR', () => {
    const { zones } = calculateHrZones({ ...base, method: 'threshold' });
    expect(zones?.slice(0, 4).map((zone) => zone.max)).toEqual([138, 151, 158, 168]);
    expect(zones?.[4].max).toBe(190);
  });

  it('reports what is missing instead of guessing', () => {
    expect(calculateHrZones({ ...base, method: 'threshold', thresholdHeartRate: null }).unavailableReason).toBe(
      'threshold_missing',
    );
    expect(calculateHrZones({ ...base, method: 'max_hr', maxHeartRate: null }).unavailableReason).toBe('max_missing');
    expect(calculateHrZones({ ...base, method: 'custom' }).unavailableReason).toBe('custom_missing');
  });

  it('uses custom bounds as given', () => {
    const { zones } = calculateHrZones({ ...base, method: 'custom', customUpperBounds: [134, 150, 162, 176] });
    expect(zones?.map((zone) => zone.max)).toEqual([134, 150, 162, 176, 190]);
  });

  it('validates custom bounds', () => {
    expect(isValidCustomZones([134, 150, 162, 176], 52, 190)).toBe(true);
    expect(isValidCustomZones([134, 134, 162, 176], 52, 190)).toBe(false);
    expect(isValidCustomZones([134, 150, 162], 52, 190)).toBe(false);
    expect(isValidCustomZones([50, 150, 162, 176], 52, 190)).toBe(false);
    expect(isValidCustomZones([134, 150, 162, 195], 52, 190)).toBe(false);
  });

  it('estimates max HR from age (208 − 0.7 × age)', () => {
    expect(estimateMaxHeartRate(34)).toBe(184);
    expect(estimateMaxHeartRate(null)).toBeNull();
  });

  it('maps workout zone labels to heart-rate targets', () => {
    const { zones } = calculateHrZones({ ...base, method: 'max_hr' });
    expect(heartRateRangeForZone(zones!, 'Z2', 52)).toEqual({ min: 114, max: 133 });
    expect(heartRateRangeForZone(zones!, 'Z1', 52)).toEqual({ min: 97, max: 114 });
    expect(heartRateRangeForZone(zones!, 'Z5', 52)).toEqual({ min: 171, max: 190 });
    expect(heartRateRangeForZone(zones!, 'rest', 52)).toBeNull();
  });
});
