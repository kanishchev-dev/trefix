import {
  DEVICE_ACTIVITY_LIMITS,
  DEVICE_SYNC_HISTORY_MAX_DAYS,
  type DeviceActivityRejectCode,
  type DeviceProviderName,
  SPORT_BY_ACTIVITY_TYPE,
  SPORT_PACE_LIMITS,
} from '../constants/integrations.constants';
import type { StoredDeviceActivity } from '../entities/device-sync-batch.entity';
import type { RunningActivity, RunningActivityType } from '../interfaces/running-activity.interface';
import type { DeviceActivityDto } from './dto/device-sync-batch.dto';

const DEVICE_ACTIVITY_TYPES: ReadonlySet<string> = new Set<RunningActivityType>([
  'run',
  'trail_run',
  'treadmill',
  'walk',
  'hike',
  'strength',
]);
const DAY_MS = 24 * 60 * 60 * 1000;

export type DeviceActivityCheck =
  { ok: true; activity: StoredDeviceActivity } | { ok: false; code: DeviceActivityRejectCode };

function withinRange(value: number | undefined, range: { min: number; max: number }): number | null {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null;
  }
  return value >= range.min && value <= range.max ? Math.round(value) : null;
}

/**
 * Plausibility of one record from the app. Out-of-range HR and cadence are
 * dropped instead of rejecting the record: the volume is still a valid fact.
 */
export function checkDeviceActivity(dto: DeviceActivityDto, now: Date): DeviceActivityCheck {
  if (!DEVICE_ACTIVITY_TYPES.has(dto.type)) {
    return { ok: false, code: 'ACTIVITY_NOT_RUNNING' };
  }
  const sport = SPORT_BY_ACTIVITY_TYPE[dto.type as RunningActivityType];
  const startedAt = new Date(dto.startedAt);
  const endedAt = new Date(dto.endedAt);
  if (endedAt.getTime() <= startedAt.getTime()) {
    return { ok: false, code: 'ACTIVITY_TIME_RANGE_INVALID' };
  }
  if (startedAt.getTime() > now.getTime() + DEVICE_ACTIVITY_LIMITS.futureToleranceSec * 1000) {
    return { ok: false, code: 'ACTIVITY_IN_FUTURE' };
  }
  if (startedAt.getTime() < now.getTime() - DEVICE_SYNC_HISTORY_MAX_DAYS * DAY_MS) {
    return { ok: false, code: 'ACTIVITY_TOO_OLD' };
  }
  if (dto.durationSec > DEVICE_ACTIVITY_LIMITS.maxDurationSec) {
    return { ok: false, code: 'ACTIVITY_DURATION_INVALID' };
  }
  if (sport === 'strength') {
    if (dto.durationSec < DEVICE_ACTIVITY_LIMITS.minStrengthDurationSec) {
      return { ok: false, code: 'ACTIVITY_TOO_SHORT' };
    }
  } else {
    if (
      dto.distanceMeters < DEVICE_ACTIVITY_LIMITS.minDistanceMeters ||
      dto.durationSec < DEVICE_ACTIVITY_LIMITS.minDurationSec
    ) {
      return { ok: false, code: 'ACTIVITY_TOO_SHORT' };
    }
    const paceSecPerKm = (dto.durationSec / dto.distanceMeters) * 1000;
    const pace =
      sport === 'run'
        ? { min: DEVICE_ACTIVITY_LIMITS.fastestPaceSecPerKm, max: DEVICE_ACTIVITY_LIMITS.slowestPaceSecPerKm }
        : SPORT_PACE_LIMITS[sport];
    if (paceSecPerKm < pace.min || paceSecPerKm > pace.max) {
      return { ok: false, code: 'ACTIVITY_PACE_IMPLAUSIBLE' };
    }
  }

  const averageHeartRate = withinRange(dto.averageHeartRate, DEVICE_ACTIVITY_LIMITS.heartRate);
  const maxHeartRate = withinRange(dto.maxHeartRate, DEVICE_ACTIVITY_LIMITS.heartRate);

  return {
    ok: true,
    activity: {
      sourceActivityId: dto.sourceActivityId,
      type: dto.type,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      utcOffsetMinutes: dto.utcOffsetMinutes ?? null,
      durationSec: dto.durationSec,
      elapsedTimeSec: dto.elapsedTimeSec ?? null,
      distanceMeters: sport === 'strength' ? 0 : Math.round(dto.distanceMeters),
      elevationGainMeters: dto.elevationGainMeters !== undefined ? Math.round(dto.elevationGainMeters) : null,
      averageHeartRate,
      maxHeartRate:
        maxHeartRate !== null && averageHeartRate !== null && maxHeartRate < averageHeartRate ? null : maxHeartRate,
      cadence: withinRange(dto.cadence, DEVICE_ACTIVITY_LIMITS.cadence),
      calories: dto.calories !== undefined ? Math.round(dto.calories) : null,
      originAppId: dto.originAppId ?? null,
      originDevice: dto.originDevice ?? null,
    },
  };
}

/** Accepted device record → domain activity handed to ingestion. */
export function toRunningActivity(
  athleteId: string,
  provider: DeviceProviderName,
  stored: StoredDeviceActivity,
): RunningActivity {
  const startedAt = new Date(stored.startedAt);
  const endedAt = new Date(stored.endedAt);
  const now = new Date();
  return {
    id: `${provider}:${stored.sourceActivityId}`,
    athleteId,
    source: provider,
    sourceActivityId: stored.sourceActivityId,
    type: stored.type as RunningActivityType,
    startedAt,
    endedAt,
    durationSec: stored.durationSec,
    movingTimeSec: stored.durationSec,
    elapsedTimeSec: stored.elapsedTimeSec ?? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
    distanceMeters: stored.distanceMeters,
    elevationGainMeters: stored.elevationGainMeters ?? undefined,
    averagePaceSecPerKm:
      stored.distanceMeters > 0 ? Math.round((stored.durationSec / stored.distanceMeters) * 1000) : undefined,
    averageSpeedMps: stored.durationSec > 0 ? stored.distanceMeters / stored.durationSec : undefined,
    averageHeartRate: stored.averageHeartRate ?? undefined,
    maxHeartRate: stored.maxHeartRate ?? undefined,
    cadence: stored.cadence ?? undefined,
    calories: stored.calories ?? undefined,
    utcOffsetMinutes: stored.utcOffsetMinutes ?? undefined,
    originAppId: stored.originAppId ?? undefined,
    originDevice: stored.originDevice ?? undefined,
    importedAt: now,
    updatedAt: now,
    status: 'imported',
  };
}

/** Median of daily resting HR over the latest days with data; null when there are too few days. */
export function restingHeartRateMedian(
  samples: Array<{ date: string; bpm: number }>,
  days: number,
  minDays: number,
): { bpm: number; latestDate: string } | null {
  const byDate = new Map<string, number>();
  for (const sample of samples) {
    byDate.set(sample.date, sample.bpm);
  }
  const latest = [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, days);
  if (latest.length < minDays) {
    return null;
  }
  const values = latest.map(([, bpm]) => bpm).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
  return { bpm: Math.round(median), latestDate: latest[0][0] };
}
