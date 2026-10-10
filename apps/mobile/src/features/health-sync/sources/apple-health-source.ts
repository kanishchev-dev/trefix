import { Linking } from "react-native";
import {
  getBiologicalSexAsync,
  getDateOfBirthAsync,
  getMostRecentQuantitySample,
  isHealthDataAvailableAsync,
  queryQuantitySamples,
  queryWorkoutSamplesWithAnchor,
  requestAuthorization,
  WorkoutActivityType,
} from "@kingstinct/react-native-healthkit";
import type { DeviceActivity, DeviceProfileMetricsRequest, DeviceScope } from "@workspace/api-client";

import { mapAppleWorkout, type AppleWorkoutInput, type AppleWorkoutStats } from "../mapping/apple-health-mapper";
import { localDateKey } from "../mapping/time";
import { toKilograms } from "../mapping/units";
import type { DeviceHealthSource, HealthAvailability, SyncCursor, WorkoutChangesPage } from "../types";

const PAGE_SIZE = 25;
const RESTING_HR_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const READ_TYPES = [
  "HKWorkoutTypeIdentifier",
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierDistanceWalkingRunning",
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierBodyMass",
  "HKQuantityTypeIdentifierHeight",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKCharacteristicTypeIdentifierBiologicalSex",
  "HKCharacteristicTypeIdentifierDateOfBirth",
] as const;

/** HealthKit BiologicalSex: 0 notSet, 1 female, 2 male, 3 other. */
const SEX_BY_HEALTHKIT: Record<number, DeviceProfileMetricsRequest["sex"]> = { 1: "female", 2: "male", 3: "other" };

/** iOS never tells whether read access was granted: these are the scopes that were requested. */
const REQUESTED_SCOPES: DeviceScope[] = [
  "workouts",
  "heart_rate",
  "distance",
  "steps",
  "calories",
  "weight",
  "height",
  "resting_heart_rate",
  "background",
];

type AppleCursor = { anchor: string; since: string };

function parseCursor(cursor: SyncCursor | null): AppleCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(cursor) as AppleCursor;
    return typeof parsed.anchor === "string" ? parsed : null;
  } catch {
    return null;
  }
}

type WorkoutProxyLike = {
  toJSON(): unknown;
  dispose?: () => void;
  getStatistic(
    type: string,
    unit?: string,
  ): Promise<{ averageQuantity?: { quantity: number }; maximumQuantity?: { quantity: number }; sumQuantity?: { quantity: number } } | undefined>;
};

async function statisticsOf(workout: WorkoutProxyLike, needDistance: boolean): Promise<AppleWorkoutStats> {
  const safe = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await work();
    } catch {
      return undefined;
    }
  };
  const [heartRate, steps, distance] = await Promise.all([
    safe(() => workout.getStatistic("HKQuantityTypeIdentifierHeartRate", "count/min")),
    safe(() => workout.getStatistic("HKQuantityTypeIdentifierStepCount", "count")),
    needDistance ? safe(() => workout.getStatistic("HKQuantityTypeIdentifierDistanceWalkingRunning", "m")) : undefined,
  ]);
  return {
    averageHeartRate: heartRate?.averageQuantity?.quantity,
    maxHeartRate: heartRate?.maximumQuantity?.quantity,
    steps: steps?.sumQuantity?.quantity,
    distanceMeters: distance?.sumQuantity?.quantity,
  };
}

export const appleHealthSource: DeviceHealthSource = {
  provider: "apple_health",

  async getAvailability(): Promise<HealthAvailability> {
    try {
      return (await isHealthDataAvailableAsync()) ? "available" : "unsupported";
    } catch {
      return "unsupported";
    }
  },

  async requestPermissions(): Promise<DeviceScope[]> {
    await requestAuthorization({ toRead: [...READ_TYPES] });
    return REQUESTED_SCOPES;
  },

  async getGrantedScopes(): Promise<DeviceScope[]> {
    return REQUESTED_SCOPES;
  },

  async ensureReadAccess(): Promise<void> {
    // HealthKit shows the sheet only for types the user has not answered yet.
    await requestAuthorization({ toRead: [...READ_TYPES] });
  },

  async readWorkoutChanges(cursor, since): Promise<WorkoutChangesPage> {
    const state = parseCursor(cursor) ?? { anchor: "", since: since.toISOString() };
    const response = await queryWorkoutSamplesWithAnchor({
      limit: PAGE_SIZE,
      anchor: state.anchor || undefined,
      filter: {
        workoutActivityType: WorkoutActivityType.running,
        date: { startDate: new Date(state.since) },
      },
    });

    const activities: DeviceActivity[] = [];
    for (const workout of response.workouts) {
      const proxy = workout as unknown as WorkoutProxyLike;
      const json = proxy.toJSON() as AppleWorkoutInput;
      const stats = await statisticsOf(proxy, !json.totalDistance);
      proxy.dispose?.();
      const activity = mapAppleWorkout(json, stats);
      if (activity) activities.push(activity);
    }

    return {
      activities,
      deletedSourceActivityIds: response.deletedSamples.map((sample) => sample.uuid),
      nextCursor: JSON.stringify({ anchor: response.newAnchor, since: state.since } satisfies AppleCursor),
      hasMore: response.workouts.length >= PAGE_SIZE,
    };
  },

  async readProfileMetrics(now): Promise<DeviceProfileMetricsRequest> {
    const metrics: DeviceProfileMetricsRequest = {};
    try {
      const weight = await getMostRecentQuantitySample("HKQuantityTypeIdentifierBodyMass", "kg");
      const valueKg = weight ? toKilograms({ quantity: weight.quantity, unit: weight.unit }) : undefined;
      if (weight && valueKg) {
        metrics.weight = {
          valueKg: Math.round(valueKg * 10) / 10,
          measuredAt: new Date(weight.endDate).toISOString(),
          originAppId: weight.sourceRevision?.source?.bundleIdentifier,
        };
      }
    } catch {
      // No access or no data: the profile keeps its value.
    }
    try {
      const height = await getMostRecentQuantitySample("HKQuantityTypeIdentifierHeight", "cm");
      if (height && height.quantity > 0) {
        metrics.height = {
          valueCm: Math.round(height.quantity),
          measuredAt: new Date(height.endDate).toISOString(),
          originAppId: height.sourceRevision?.source?.bundleIdentifier,
        };
      }
    } catch {
      // Same as above.
    }
    try {
      const sex = SEX_BY_HEALTHKIT[Number(await getBiologicalSexAsync())];
      if (sex) metrics.sex = sex;
    } catch {
      // Same as above.
    }
    try {
      const birth = await getDateOfBirthAsync();
      // The date of birth is a calendar date stored at local midnight.
      if (birth) metrics.birthDate = localDateKey(birth);
    } catch {
      // Same as above.
    }
    try {
      const samples = await queryQuantitySamples("HKQuantityTypeIdentifierRestingHeartRate", {
        limit: RESTING_HR_DAYS * 2,
        ascending: false,
        unit: "count/min",
        filter: { date: { startDate: new Date(now.getTime() - RESTING_HR_DAYS * DAY_MS) } },
      });
      const byDay = new Map<string, number>();
      for (const sample of samples) {
        const day = localDateKey(new Date(sample.startDate));
        if (!byDay.has(day)) byDay.set(day, Math.round(sample.quantity));
      }
      if (byDay.size > 0) {
        metrics.restingHeartRate = [...byDay.entries()].map(([date, bpm]) => ({ date, bpm })).slice(0, RESTING_HR_DAYS);
      }
    } catch {
      // Same as above.
    }
    return metrics;
  },

  async openSystemSettings(): Promise<void> {
    const healthUrl = "x-apple-health://";
    if (await Linking.canOpenURL(healthUrl).catch(() => false)) {
      await Linking.openURL(healthUrl);
      return;
    }
    await Linking.openSettings();
  },
};

