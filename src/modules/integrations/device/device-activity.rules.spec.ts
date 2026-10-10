import { checkDeviceActivity, restingHeartRateMedian, toRunningActivity } from './device-activity.rules';
import type { DeviceActivityDto } from './dto/device-sync-batch.dto';

const NOW = new Date('2026-10-09T12:00:00Z');

const dto = (overrides: Partial<DeviceActivityDto> = {}): DeviceActivityDto => ({
  sourceActivityId: 'hk-1',
  type: 'run',
  startedAt: '2026-10-08T05:00:00Z',
  endedAt: '2026-10-08T05:50:00Z',
  utcOffsetMinutes: 180,
  durationSec: 3000,
  distanceMeters: 10000.4,
  averageHeartRate: 148,
  maxHeartRate: 171,
  cadence: 172,
  originAppId: 'com.apple.health',
  ...overrides,
});

const codeOf = (overrides: Partial<DeviceActivityDto>): string | null => {
  const check = checkDeviceActivity(dto(overrides), NOW);
  return check.ok ? null : check.code;
};

describe('checkDeviceActivity', () => {
  it('accepts a normal run and normalizes it', () => {
    const check = checkDeviceActivity(dto(), NOW);
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.activity).toMatchObject({
        distanceMeters: 10000,
        startedAt: '2026-10-08T05:00:00.000Z',
        averageHeartRate: 148,
        maxHeartRate: 171,
        cadence: 172,
        elevationGainMeters: null,
        utcOffsetMinutes: 180,
      });
    }
  });

  it.each([
    [{ type: 'cycling' }, 'ACTIVITY_NOT_RUNNING'],
    [{ endedAt: '2026-10-08T04:59:00Z' }, 'ACTIVITY_TIME_RANGE_INVALID'],
    [{ startedAt: '2026-10-09T12:06:00Z', endedAt: '2026-10-09T13:00:00Z' }, 'ACTIVITY_IN_FUTURE'],
    [{ startedAt: '2025-10-01T05:00:00Z', endedAt: '2025-10-01T06:00:00Z' }, 'ACTIVITY_TOO_OLD'],
    [{ distanceMeters: 499 }, 'ACTIVITY_TOO_SHORT'],
    [{ durationSec: 179, distanceMeters: 600 }, 'ACTIVITY_TOO_SHORT'],
    [{ durationSec: 90_000 }, 'ACTIVITY_DURATION_INVALID'],
    [{ durationSec: 1000, distanceMeters: 10000 }, 'ACTIVITY_PACE_IMPLAUSIBLE'],
    [{ durationSec: 9500, distanceMeters: 10000 }, 'ACTIVITY_PACE_IMPLAUSIBLE'],
  ])('rejects %j with %s', (overrides, code) => {
    expect(codeOf(overrides as Partial<DeviceActivityDto>)).toBe(code);
  });

  it('accepts treadmill and trail runs', () => {
    expect(codeOf({ type: 'treadmill' })).toBeNull();
    expect(codeOf({ type: 'trail_run' })).toBeNull();
  });

  it('drops implausible HR and cadence instead of rejecting the run', () => {
    const check = checkDeviceActivity(dto({ averageHeartRate: 250, maxHeartRate: 20, cadence: 400 }), NOW);
    expect(check.ok && check.activity).toMatchObject({ averageHeartRate: null, maxHeartRate: null, cadence: null });
  });

  it('drops a max HR below the average', () => {
    const check = checkDeviceActivity(dto({ averageHeartRate: 150, maxHeartRate: 140 }), NOW);
    expect(check.ok && check.activity.maxHeartRate).toBeNull();
  });
});

describe('toRunningActivity', () => {
  it('maps a stored record to the domain activity', () => {
    const check = checkDeviceActivity(dto({ originDevice: 'Apple Watch' }), NOW);
    if (!check.ok) throw new Error('expected ok');
    const activity = toRunningActivity('athlete-1', 'apple_health', check.activity);
    expect(activity).toMatchObject({
      id: 'apple_health:hk-1',
      athleteId: 'athlete-1',
      source: 'apple_health',
      movingTimeSec: 3000,
      elapsedTimeSec: 3000,
      averagePaceSecPerKm: 300,
      utcOffsetMinutes: 180,
      originAppId: 'com.apple.health',
      originDevice: 'Apple Watch',
    });
    expect(activity.startedAt).toEqual(new Date('2026-10-08T05:00:00Z'));
  });
});

describe('restingHeartRateMedian', () => {
  const day = (date: string, bpm: number): { date: string; bpm: number } => ({ date, bpm });

  it('takes the median of the latest 7 days', () => {
    const samples = [
      day('2026-10-01', 70),
      day('2026-10-02', 50),
      day('2026-10-03', 51),
      day('2026-10-04', 52),
      day('2026-10-05', 53),
      day('2026-10-06', 54),
      day('2026-10-07', 55),
      day('2026-10-08', 90),
    ];
    expect(restingHeartRateMedian(samples, 7, 3)).toEqual({ bpm: 53, latestDate: '2026-10-08' });
  });

  it('averages the two middle values for an even count', () => {
    expect(
      restingHeartRateMedian(
        [day('2026-10-01', 50), day('2026-10-02', 53), day('2026-10-03', 55), day('2026-10-04', 60)],
        7,
        3,
      )?.bpm,
    ).toBe(54);
  });

  it('needs at least the minimum number of days; duplicates of a date count once', () => {
    expect(
      restingHeartRateMedian([day('2026-10-01', 50), day('2026-10-01', 52), day('2026-10-02', 53)], 7, 3),
    ).toBeNull();
  });
});
