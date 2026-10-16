import { describe, expect, it } from "vitest";

import { decodePolyline, encodePolyline, simplifyTo } from "./geo";
import { RecordingEngine } from "./recording-engine";
import { buildRecording, buildSplits } from "./summary";
import type { LocationSample, TimelineSample } from "./types";

const T0 = Date.parse("2026-10-11T06:00:00Z");
const device = { platform: "ios" as const, model: "iPhone16,2" };

describe("buildSplits", () => {
  const timeline: TimelineSample[] = [
    [0, 0, 0],
    [300_000, 1000, 5],
    [610_000, 2000, 5],
    [760_000, 2500, 12],
  ];

  it("cuts kilometres and keeps the tail as a partial split", () => {
    expect(buildSplits(timeline, 2500, 2500)).toEqual([
      {
        km: 1,
        durationSec: 300,
        paceSecPerKm: 300,
        elevationGainM: 5,
        partial: false,
      },
      {
        km: 2,
        durationSec: 310,
        paceSecPerKm: 310,
        elevationGainM: 0,
        partial: false,
      },
      {
        km: 3,
        durationSec: 150,
        paceSecPerKm: 300,
        elevationGainM: 7,
        partial: true,
      },
    ]);
  });

  it("follows a corrected distance", () => {
    const splits = buildSplits(timeline, 2500, 3000);
    expect(splits.map((split) => split.km)).toEqual([1, 2, 3]);
    expect(splits.every((split) => !split.partial)).toBe(true);
    expect(splits.reduce((sum, split) => sum + split.durationSec, 0)).toBe(760);
  });
});

describe("geo", () => {
  it("round-trips an encoded polyline", () => {
    const points = [
      { lat: 55.75, lng: 37.62 },
      { lat: 55.75123, lng: 37.61987 },
      { lat: 55.74998, lng: 37.62501 },
    ];
    expect(decodePolyline(encodePolyline(points))).toEqual(points);
  });

  it("simplifies a long straight line to its ends", () => {
    const line = Array.from({ length: 1000 }, (_, i) => ({
      lat: 55.75 + i * 1e-5,
      lng: 37.62,
    }));
    expect(simplifyTo(line, 500)).toHaveLength(2);
  });
});

describe("buildRecording", () => {
  it("builds the request and the track of a GPS run", () => {
    const engine = RecordingEngine.start(
      {
        environment: "outdoor",
        distanceMode: "gps",
        strideM: 1,
        autoPause: false,
      },
      T0,
    );
    const points: LocationSample[] = [];
    for (let second = 0; second <= 700; second += 1) {
      const sample = {
        t: T0 + second * 1000,
        lat: 55.75 + (second * 3) / 111_195,
        lng: 37.62,
        alt: 150,
        acc: 5,
        speed: 3,
      };
      if (engine.onLocation(sample)) points.push(sample);
    }
    engine.finish(T0 + 700_000);

    const { summary, track } = buildRecording(
      "session-1",
      engine.state,
      points,
      { workoutType: "easy", rpe: 4 },
      device,
    );

    expect(summary).toMatchObject({
      clientSessionId: "session-1",
      environment: "outdoor",
      distanceSource: "gps",
      movingSec: 700,
      elapsedSec: 700,
      workoutType: "easy",
      rpe: 4,
      measuredDistanceM: summary.distanceM,
    });
    expect(summary.distanceM).toBeGreaterThan(2090);
    expect(summary.splits?.map((split) => split.km)).toEqual([1, 2, 3]);
    expect(summary.bestPaceSecPerKm).toBeCloseTo(333, -1);
    expect(summary.routeLine).toBeTruthy();
    expect(track?.points.t[0]).toBe(0);
    expect(track?.points.lat).toHaveLength(points.length);
  });

  it("marks a corrected treadmill distance as manual", () => {
    const engine = RecordingEngine.start(
      {
        environment: "treadmill",
        distanceMode: "time",
        strideM: 1,
        autoPause: false,
      },
      T0,
    );
    engine.onSteps(0, T0);
    for (let second = 1; second <= 600; second += 1)
      engine.onSteps(second * 3, T0 + second * 1000);
    engine.finish(T0 + 600_000);

    const { summary, track } = buildRecording(
      "session-2",
      engine.state,
      [],
      { distanceM: 2000 },
      device,
    );
    expect(summary).not.toHaveProperty("linkPlanned");
    expect(summary).toMatchObject({
      distanceSource: "manual",
      distanceM: 2000,
      measuredDistanceM: 1800,
      routeLine: null,
    });
    expect(summary.splits?.map((split) => split.km)).toEqual([1, 2]);
    expect(track).toBeNull();
  });
});
