import type { DeviceActivity } from "@trefix/api-client";

import { deviceOffsetMinutes, zoneOffsetMinutes } from "./time";
import { positiveRound, toKilocalories, toMeters, toSeconds } from "./units";

type Quantity = { quantity: number; unit: string };

/** The parts of an `HKWorkout` (plain JSON) the mapper reads. */
export type AppleWorkoutInput = {
  uuid: string;
  startDate: Date | string;
  endDate: Date | string;
  duration?: Quantity;
  totalDistance?: Quantity;
  totalEnergyBurned?: Quantity;
  metadata?: Record<string, unknown>;
  sourceRevision?: { source?: { bundleIdentifier?: string; name?: string } };
  device?: { name?: string; model?: string };
};

/** Statistics computed over the workout interval. */
export type AppleWorkoutStats = {
  averageHeartRate?: number;
  maxHeartRate?: number;
  steps?: number;
  distanceMeters?: number;
  activeEnergyKcal?: number;
};

function isQuantity(value: unknown): value is Quantity {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Quantity).quantity === "number" &&
    typeof (value as Quantity).unit === "string"
  );
}

/** HKWorkout (running) → run in the backend's shape. Returns null when volume is unknown. */
export function mapAppleWorkout(
  workout: AppleWorkoutInput,
  stats: AppleWorkoutStats,
): DeviceActivity | null {
  const startedAt = new Date(workout.startDate);
  const endedAt = new Date(workout.endDate);
  const elapsedTimeSec = Math.round(
    (endedAt.getTime() - startedAt.getTime()) / 1000,
  );
  const durationSec = Math.round(toSeconds(workout.duration) ?? elapsedTimeSec);
  const distanceMeters =
    toMeters(workout.totalDistance) ?? stats.distanceMeters;
  if (!distanceMeters || distanceMeters <= 0 || durationSec <= 0) {
    return null;
  }

  const metadata = workout.metadata ?? {};
  const indoor =
    metadata.HKIndoorWorkout === true || metadata.HKIndoorWorkout === 1;
  const timeZone =
    typeof metadata.HKTimeZone === "string" ? metadata.HKTimeZone : undefined;
  const elevation = isQuantity(metadata.HKElevationAscended)
    ? toMeters(metadata.HKElevationAscended)
    : undefined;
  const calories =
    toKilocalories(workout.totalEnergyBurned) ?? stats.activeEnergyKcal;
  const cadence =
    stats.steps && durationSec > 0
      ? (stats.steps / durationSec) * 60
      : undefined;
  const originDevice =
    workout.device?.name ?? workout.device?.model ?? undefined;

  return {
    sourceActivityId: workout.uuid,
    type: indoor ? "treadmill" : "run",
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    utcOffsetMinutes:
      (timeZone ? zoneOffsetMinutes(startedAt, timeZone) : undefined) ??
      deviceOffsetMinutes(startedAt),
    durationSec,
    elapsedTimeSec,
    distanceMeters: Math.round(distanceMeters),
    elevationGainMeters: positiveRound(elevation),
    averageHeartRate: positiveRound(stats.averageHeartRate),
    maxHeartRate: positiveRound(stats.maxHeartRate),
    cadence: positiveRound(cadence),
    calories: positiveRound(calories),
    originAppId: workout.sourceRevision?.source?.bundleIdentifier,
    originDevice,
  };
}
