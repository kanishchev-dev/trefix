import type { WorkoutSourceFacts } from '../entities/workout-source.entity';
import { ActivityDedupService, SourceRecord } from './activity-dedup.service';

const baseFacts: WorkoutSourceFacts = {
  type: 'run',
  movingTimeSec: 3000,
  elapsedTimeSec: 3100,
  elevationGainMeters: null,
  averageHeartRate: null,
  maxHeartRate: null,
  cadence: null,
  calories: null,
  gearExternalId: null,
};

function record(overrides: Partial<SourceRecord> = {}): SourceRecord {
  const startedAt = overrides.startedAt ?? new Date('2026-10-08T05:00:00Z');
  return {
    provider: 'apple_health',
    sourceActivityId: 'hk-1',
    startedAt,
    endedAt: overrides.endedAt ?? new Date(startedAt.getTime() + 3000 * 1000),
    durationSec: 3000,
    distanceMeters: 10000,
    facts: { ...baseFacts },
    createdAt: new Date('2026-10-08T06:00:00Z'),
    ...overrides,
  };
}

const at = (iso: string): Date => new Date(iso);

describe('ActivityDedupService', () => {
  const service = new ActivityDedupService();

  describe('overlapRatio', () => {
    it('measures the intersection against the shorter record', () => {
      const a = record({ startedAt: at('2026-10-08T05:00:00Z'), endedAt: at('2026-10-08T06:00:00Z') });
      const b = record({ startedAt: at('2026-10-08T05:30:00Z'), endedAt: at('2026-10-08T05:50:00Z') });
      expect(service.overlapRatio(a, b)).toBe(1);
    });

    it('is zero for disjoint ranges', () => {
      const a = record({ startedAt: at('2026-10-08T05:00:00Z'), endedAt: at('2026-10-08T05:30:00Z') });
      const b = record({ startedAt: at('2026-10-08T06:00:00Z'), endedAt: at('2026-10-08T06:30:00Z') });
      expect(service.overlapRatio(a, b)).toBe(0);
    });
  });

  describe('isSameRun', () => {
    const strava = (overrides: Partial<SourceRecord> = {}): SourceRecord =>
      record({ provider: 'strava', sourceActivityId: 's-1', ...overrides });

    it('matches the same run recorded by watch and Strava', () => {
      expect(
        service.isSameRun(record(), strava({ startedAt: at('2026-10-08T05:00:07Z'), distanceMeters: 10040 })),
      ).toBe(true);
    });

    it('accepts exactly 80% overlap and rejects less', () => {
      const a = record({ startedAt: at('2026-10-08T05:00:00Z'), endedAt: at('2026-10-08T05:50:00Z') });
      const edge = strava({ startedAt: at('2026-10-08T05:10:00Z'), endedAt: at('2026-10-08T06:00:00Z') });
      expect(service.overlapRatio(a, edge)).toBeCloseTo(0.8);
      expect(service.isSameRun(a, edge)).toBe(true);
      const less = strava({ startedAt: at('2026-10-08T05:10:01Z'), endedAt: at('2026-10-08T06:00:01Z') });
      expect(service.isSameRun(a, less)).toBe(false);
    });

    it('rejects starts more than 10 minutes apart', () => {
      const a = record({ startedAt: at('2026-10-08T05:00:00Z'), endedAt: at('2026-10-08T07:00:00Z') });
      const b = strava({ startedAt: at('2026-10-08T05:10:01Z'), endedAt: at('2026-10-08T07:00:00Z') });
      expect(service.isSameRun(a, b)).toBe(false);
    });

    it('allows max(5%, 300 m) of distance difference', () => {
      expect(service.isSameRun(record({ distanceMeters: 3000 }), strava({ distanceMeters: 3300 }))).toBe(true);
      expect(service.isSameRun(record({ distanceMeters: 3000 }), strava({ distanceMeters: 3301 }))).toBe(false);
      expect(service.isSameRun(record({ distanceMeters: 20000 }), strava({ distanceMeters: 21000 }))).toBe(true);
      expect(service.isSameRun(record({ distanceMeters: 20000 }), strava({ distanceMeters: 21100 }))).toBe(false);
    });
  });

  describe('findDuplicate', () => {
    it('ignores candidates of the same provider and picks the largest overlap', () => {
      const incoming = record();
      const sameProvider = record({ sourceActivityId: 'hk-2' });
      const partial = record({
        provider: 'strava',
        sourceActivityId: 's-partial',
        startedAt: at('2026-10-08T05:05:00Z'),
        endedAt: at('2026-10-08T05:55:00Z'),
      });
      const full = record({ provider: 'garmin', sourceActivityId: 'g-full' });
      expect(service.findDuplicate(incoming, [sameProvider, partial, full])).toBe(full);
    });

    it('returns null when nothing matches', () => {
      expect(service.findDuplicate(record(), [record({ provider: 'strava', distanceMeters: 5000 })])).toBeNull();
    });
  });

  describe('orderByPriority', () => {
    it('orders garmin > strava > apple_health > health_connect, then by first seen', () => {
      const hc = record({ provider: 'health_connect' });
      const hk = record({ provider: 'apple_health' });
      const stravaLate = record({
        provider: 'strava',
        sourceActivityId: 'late',
        createdAt: at('2026-10-08T08:00:00Z'),
      });
      const stravaEarly = record({
        provider: 'strava',
        sourceActivityId: 'early',
        createdAt: at('2026-10-08T07:00:00Z'),
      });
      const garmin = record({ provider: 'garmin' });
      expect(service.orderByPriority([hc, stravaLate, hk, garmin, stravaEarly])).toEqual([
        garmin,
        stravaEarly,
        stravaLate,
        hk,
        hc,
      ]);
    });
  });

  describe('merge', () => {
    it('takes range and volume from the primary and fills gaps from other sources', () => {
      const strava = record({
        provider: 'strava',
        sourceActivityId: 's-1',
        distanceMeters: 10050,
        durationSec: 3010,
        facts: { ...baseFacts, movingTimeSec: 3010, gearExternalId: 'g123', cadence: 168 },
      });
      const watch = record({
        facts: { ...baseFacts, averageHeartRate: 148, maxHeartRate: 171, cadence: 172, elevationGainMeters: 64 },
      });

      const merged = service.merge([watch, strava]);

      expect(merged.primary).toBe(strava);
      expect(merged.gearExternalId).toBe('g123');
      expect(merged.facts).toMatchObject({
        sourceProvider: 'strava',
        sourceActivityId: 's-1',
        distanceKm: 10.1,
        durationMinutes: 50,
        averagePaceSecondsPerKm: 300,
        averageHeartRate: 148,
        maxHeartRate: 171,
        cadence: 168,
        elevationGainMeters: 64,
        indoor: false,
      });
    });

    it('marks treadmill runs as indoor', () => {
      expect(service.merge([record({ facts: { ...baseFacts, type: 'treadmill' } })]).facts.indoor).toBe(true);
    });

    it('throws on an empty list', () => {
      expect(() => service.merge([])).toThrow();
    });
  });
});
