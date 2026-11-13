import { describe, expect, it } from "vitest";

import {
  mapHealthConnectSession,
  type HealthConnectSessionInput,
} from "./health-connect-mapper";

const session = (
  overrides: Partial<HealthConnectSessionInput> = {},
): HealthConnectSessionInput => ({
  startTime: "2026-10-08T04:00:00.000Z",
  endTime: "2026-10-08T05:00:00.000Z",
  exerciseType: 56,
  startZoneOffset: { totalSeconds: 10800 },
  metadata: {
    id: "hc-session-1",
    dataOrigin: "com.garmin.android.apps.connectmobile",
    device: { manufacturer: "Garmin", model: "Forerunner 265" },
  },
  ...overrides,
});

describe("mapHealthConnectSession", () => {
  it("maps a run with aggregates", () => {
    expect(
      mapHealthConnectSession(session(), {
        distanceMeters: 10234.6,
        elevationGainMeters: 51.2,
        averageHeartRate: 151.4,
        maxHeartRate: 176,
        steps: 10200,
        activeCaloriesKcal: 690.2,
      }),
    ).toEqual({
      sourceActivityId: "hc-session-1",
      type: "run",
      startedAt: "2026-10-08T04:00:00.000Z",
      endedAt: "2026-10-08T05:00:00.000Z",
      utcOffsetMinutes: 180,
      durationSec: 3600,
      elapsedTimeSec: 3600,
      distanceMeters: 10235,
      elevationGainMeters: 51,
      averageHeartRate: 151,
      maxHeartRate: 176,
      cadence: 170,
      calories: 690,
      originAppId: "com.garmin.android.apps.connectmobile",
      originDevice: "Garmin Forerunner 265",
    });
  });

  it("subtracts pause and rest segments from moving time", () => {
    const mapped = mapHealthConnectSession(
      session({
        segments: [
          {
            startTime: "2026-10-08T04:20:00.000Z",
            endTime: "2026-10-08T04:25:00.000Z",
            segmentType: 39,
          },
          {
            startTime: "2026-10-08T04:55:00.000Z",
            endTime: "2026-10-08T05:10:00.000Z",
            segmentType: 44,
          },
          {
            startTime: "2026-10-08T04:30:00.000Z",
            endTime: "2026-10-08T04:40:00.000Z",
            segmentType: 46,
          },
        ],
      }),
      { distanceMeters: 9000 },
    );
    expect(mapped).toMatchObject({ durationSec: 3000, elapsedTimeSec: 3600 });
  });

  it("marks treadmill sessions", () => {
    expect(
      mapHealthConnectSession(session({ exerciseType: 57 }), {
        distanceMeters: 5000,
      })?.type,
    ).toBe("treadmill");
  });

  it("skips non-running sessions, sessions without an id and sessions without distance", () => {
    expect(
      mapHealthConnectSession(session({ exerciseType: 8 }), {
        distanceMeters: 5000,
      }),
    ).toBeNull();
    expect(
      mapHealthConnectSession(session({ metadata: {} }), {
        distanceMeters: 5000,
      }),
    ).toBeNull();
    expect(mapHealthConnectSession(session(), {})).toBeNull();
  });
});
