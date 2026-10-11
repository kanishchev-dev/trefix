import { describe, expect, it } from "vitest";

import { mapAppleWorkout, type AppleWorkoutInput } from "./apple-health-mapper";
import { zoneOffsetMinutes } from "./time";

const workout = (
  overrides: Partial<AppleWorkoutInput> = {},
): AppleWorkoutInput => ({
  uuid: "4C1B2F2E-9D0A-4C59-9E2B-8E8F6F2C1A11",
  startDate: "2026-10-08T04:12:03Z",
  endDate: "2026-10-08T05:01:44Z",
  duration: { quantity: 2890, unit: "s" },
  totalDistance: { quantity: 10.23, unit: "km" },
  totalEnergyBurned: { quantity: 712.4, unit: "kcal" },
  metadata: {
    HKTimeZone: "Europe/Moscow",
    HKElevationAscended: { quantity: 6400, unit: "cm" },
  },
  sourceRevision: {
    source: { bundleIdentifier: "com.apple.health.8A1B", name: "Apple Watch" },
  },
  device: { name: "Apple Watch", model: "Watch" },
  ...overrides,
});

describe("mapAppleWorkout", () => {
  it("maps an outdoor run with workout statistics", () => {
    expect(
      mapAppleWorkout(workout(), {
        averageHeartRate: 147.6,
        maxHeartRate: 171,
        steps: 8300,
      }),
    ).toEqual({
      sourceActivityId: "4C1B2F2E-9D0A-4C59-9E2B-8E8F6F2C1A11",
      type: "run",
      startedAt: "2026-10-08T04:12:03.000Z",
      endedAt: "2026-10-08T05:01:44.000Z",
      utcOffsetMinutes: 180,
      durationSec: 2890,
      elapsedTimeSec: 2981,
      distanceMeters: 10230,
      elevationGainMeters: 64,
      averageHeartRate: 148,
      maxHeartRate: 171,
      cadence: 172,
      calories: 712,
      originAppId: "com.apple.health.8A1B",
      originDevice: "Apple Watch",
    });
  });

  it("marks indoor runs as treadmill", () => {
    expect(
      mapAppleWorkout(workout({ metadata: { HKIndoorWorkout: true } }), {})
        ?.type,
    ).toBe("treadmill");
    expect(
      mapAppleWorkout(workout({ metadata: { HKIndoorWorkout: 1 } }), {})?.type,
    ).toBe("treadmill");
  });

  it("falls back to the distance statistic and to elapsed time", () => {
    const mapped = mapAppleWorkout(
      workout({ totalDistance: undefined, duration: undefined }),
      { distanceMeters: 5012.4 },
    );
    expect(mapped).toMatchObject({ distanceMeters: 5012, durationSec: 2981 });
  });

  it("skips runs without any distance", () => {
    expect(
      mapAppleWorkout(workout({ totalDistance: undefined }), {}),
    ).toBeNull();
  });

  it("uses the device offset without a time zone in metadata", () => {
    const mapped = mapAppleWorkout(workout({ metadata: {} }), {});
    expect(mapped?.utcOffsetMinutes).toBe(
      -new Date("2026-10-08T04:12:03Z").getTimezoneOffset(),
    );
  });

  it("converts miles and minutes", () => {
    const mapped = mapAppleWorkout(
      workout({
        totalDistance: { quantity: 3.1, unit: "mi" },
        duration: { quantity: 30, unit: "min" },
      }),
      {},
    );
    expect(mapped).toMatchObject({ distanceMeters: 4989, durationSec: 1800 });
  });
});

describe("zoneOffsetMinutes", () => {
  it("follows daylight saving time", () => {
    expect(
      zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Europe/Berlin"),
    ).toBe(60);
    expect(
      zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Europe/Berlin"),
    ).toBe(120);
  });

  it("returns undefined for an unknown zone", () => {
    expect(zoneOffsetMinutes(new Date(), "Mars/Olympus")).toBeUndefined();
  });
});
