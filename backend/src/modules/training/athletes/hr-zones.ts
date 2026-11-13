import { HR_ZONES_MAX_HR_SHARES, HR_ZONES_THRESHOLD_SHARES, type HrZonesMethod } from '../training.constants';

export interface HrZone {
  zone: 1 | 2 | 3 | 4 | 5;
  /** Lower bound, bpm; `null` for Z1. */
  min: number | null;
  /** Upper bound, bpm; `null` for Z5 when max HR is unknown. */
  max: number | null;
}

export type HrZonesUnavailableReason = 'threshold_missing' | 'max_missing' | 'custom_missing';

export interface HrZonesInput {
  method: HrZonesMethod;
  restingHeartRate: number | null;
  maxHeartRate: number | null;
  thresholdHeartRate: number | null;
  customUpperBounds: number[] | null;
}

export interface HrZonesResult {
  zones: HrZone[] | null;
  unavailableReason: HrZonesUnavailableReason | null;
}

/** Age-predicted max heart rate (Tanaka): 208 − 0.7 × age. An estimate, never stored silently. */
export function estimateMaxHeartRate(ageYears: number | null): number | null {
  if (ageYears === null || ageYears <= 0) {
    return null;
  }
  return Math.round(208 - 0.7 * ageYears);
}

function zonesFromUpperBounds(bounds: readonly number[], top: number | null): HrZone[] {
  const [z1, z2, z3, z4] = bounds;
  return [
    { zone: 1, min: null, max: z1 },
    { zone: 2, min: z1, max: z2 },
    { zone: 3, min: z2, max: z3 },
    { zone: 4, min: z3, max: z4 },
    { zone: 5, min: z4, max: top },
  ];
}

/** Five heart-rate zones for the chosen method, or the reason they can't be built. */
export function calculateHrZones(input: HrZonesInput): HrZonesResult {
  if (input.method === 'threshold') {
    if (!input.thresholdHeartRate) {
      return { zones: null, unavailableReason: 'threshold_missing' };
    }
    const lthr = input.thresholdHeartRate;
    const bounds = HR_ZONES_THRESHOLD_SHARES.map((share) => Math.round(lthr * share));
    return { zones: zonesFromUpperBounds(bounds, input.maxHeartRate), unavailableReason: null };
  }

  if (input.method === 'custom') {
    if (!input.customUpperBounds || input.customUpperBounds.length !== 4) {
      return { zones: null, unavailableReason: 'custom_missing' };
    }
    return { zones: zonesFromUpperBounds(input.customUpperBounds, input.maxHeartRate), unavailableReason: null };
  }

  if (!input.maxHeartRate) {
    return { zones: null, unavailableReason: 'max_missing' };
  }
  const max = input.maxHeartRate;
  const bounds = HR_ZONES_MAX_HR_SHARES.map((share) => Math.round(max * share));
  return { zones: zonesFromUpperBounds(bounds, max), unavailableReason: null };
}

/**
 * Validates custom zone bounds: four strictly increasing values inside
 * (resting, max) when those are known. Returns `true` when valid.
 */
export function isValidCustomZones(
  bounds: unknown,
  restingHeartRate: number | null,
  maxHeartRate: number | null,
): bounds is number[] {
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    return false;
  }
  if (!bounds.every((value) => Number.isInteger(value) && value >= 40 && value <= 230)) {
    return false;
  }
  for (let index = 1; index < bounds.length; index += 1) {
    if (bounds[index] <= bounds[index - 1]) {
      return false;
    }
  }
  if (restingHeartRate !== null && bounds[0] <= restingHeartRate) {
    return false;
  }
  if (maxHeartRate !== null && bounds[3] >= maxHeartRate) {
    return false;
  }
  return true;
}

/**
 * Heart-rate target for a workout zone label ("Z1"…"Z5"). Z1 has no lower bound
 * in the zone table, so resting HR + 20 (or 85% of the Z1 top) is used; an
 * open Z5 gets +10 bpm.
 */
export function heartRateRangeForZone(
  zones: HrZone[],
  zoneLabel: unknown,
  restingHeartRate: number | null,
): { min: number; max: number } | null {
  if (typeof zoneLabel !== 'string') {
    return null;
  }
  const match = /^Z([1-5])$/.exec(zoneLabel);
  if (!match) {
    return null;
  }
  const zone = zones.find((entry) => entry.zone === Number(match[1]));
  if (!zone) {
    return null;
  }
  const max = zone.max ?? (zone.min !== null ? zone.min + 10 : null);
  const min =
    zone.min ??
    (max !== null ? Math.max(restingHeartRate !== null ? restingHeartRate + 20 : 0, Math.round(max * 0.85)) : null);
  if (min === null || max === null || min >= max) {
    return null;
  }
  return { min, max };
}
