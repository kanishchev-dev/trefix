import { describe, expect, it } from "vitest";

import { haversineM } from "./geo";
import { RecordingEngine } from "./recording-engine";
import type { EngineConfig, LocationSample } from "./types";

const T0 = Date.parse("2026-10-11T06:00:00Z");
const outdoor: EngineConfig = {
  environment: "outdoor",
  distanceMode: "gps",
  strideM: 1,
  autoPause: true,
};

/** Northward run at `speed` m/s, one fix a second; ~1.11e-5 deg ≈ 1.235 m of latitude. */
function fix(
  second: number,
  metres: number,
  overrides: Partial<LocationSample> = {},
): LocationSample {
  return {
    t: T0 + second * 1000,
    lat: 55.75 + metres / 111_195,
    lng: 37.62,
    alt: 150,
    acc: 5,
    speed: null,
    ...overrides,
  };
}

function runStraight(
  engine: RecordingEngine,
  fromSec: number,
  toSec: number,
  speed: number,
  startM = 0,
): number {
  let metres = startM;
  for (let second = fromSec; second <= toSec; second += 1) {
    engine.onLocation(fix(second, metres));
    metres += speed;
  }
  return metres - speed;
}

describe("RecordingEngine", () => {
  it("measures a steady GPS run", () => {
    const engine = RecordingEngine.start(outdoor, T0);
    runStraight(engine, 0, 300, 3);
    const view = engine.view(T0 + 300_000);

    expect(view.distanceM).toBeGreaterThan(895);
    expect(view.distanceM).toBeLessThan(905);
    expect(view.movingMs).toBe(300_000);
    expect(view.currentPaceSecPerKm).toBeCloseTo(333, -1);
    expect(view.gps).toBe("good");
    expect(view.onPedometer).toBe(false);
  });

  it("drops fixes that jump faster than a runner and inaccurate ones", () => {
    const engine = RecordingEngine.start(outdoor, T0);
    engine.onLocation(fix(0, 0));
    engine.onLocation(fix(1, 3));
    expect(engine.onLocation(fix(2, 200))).toBe(false);
    expect(engine.onLocation(fix(3, 9, { acc: 80 }))).toBe(false);
    engine.onLocation(fix(4, 12));
    expect(engine.view(T0 + 4000).distanceM).toBeCloseTo(12, 0);
  });

  it("auto-pauses when the runner stops and takes the standing time back", () => {
    const engine = RecordingEngine.start(outdoor, T0);
    const at = runStraight(engine, 0, 60, 3);
    for (let second = 61; second <= 90; second += 1)
      engine.onLocation(fix(second, at, { speed: 0 }));
    expect(engine.state.autoPaused).toBe(true);
    runStraight(engine, 91, 120, 3, at + 3);

    const view = engine.view(T0 + 120_000);
    expect(engine.state.autoPaused).toBe(false);
    // 60 s before the stop + about 30 s after it; the 30 s of standing are not moving time.
    expect(view.movingMs).toBeGreaterThan(85_000);
    expect(view.movingMs).toBeLessThan(95_000);
    expect(engine.state.pauses).toEqual([
      expect.objectContaining({ auto: true, startedAt: T0 + 61_000 }),
    ]);
  });

  it("counts steps while GPS is lost and resumes the track afterwards", () => {
    const engine = RecordingEngine.start(outdoor, T0);
    engine.onSteps(0, T0);
    let metres = runStraight(engine, 0, 60, 3);
    // Tunnel: no fixes for 60 s, the pedometer keeps counting.
    for (let second = 61; second <= 120; second += 1) {
      engine.tick(T0 + second * 1000);
      engine.onSteps(second * 3, T0 + second * 1000);
    }
    expect(engine.state.gps).toBe("lost");
    const beforeExit = engine.view(T0 + 120_000).distanceM;
    expect(engine.state.pedometerDistanceM).toBeGreaterThan(100);

    metres += 180;
    runStraight(engine, 121, 150, 3, metres);
    const view = engine.view(T0 + 150_000);
    expect(view.gps).toBe("good");
    // The jump between the last fix before the tunnel and the first after it is not added twice.
    expect(view.distanceM - beforeExit).toBeLessThan(95);
  });

  it("measures a treadmill run by steps and pauses when the steps stop", () => {
    const engine = RecordingEngine.start(
      {
        environment: "treadmill",
        distanceMode: "time",
        strideM: 1.1,
        autoPause: true,
      },
      T0,
    );
    expect(engine.state.gps).toBe("off");
    engine.onSteps(0, T0);
    for (let second = 1; second <= 60; second += 1)
      engine.onSteps(second * 3, T0 + second * 1000);
    for (let second = 61; second <= 75; second += 1)
      engine.tick(T0 + second * 1000);
    expect(engine.state.autoPaused).toBe(true);
    expect(engine.view(T0 + 75_000).movingMs).toBe(60_000);
    expect(engine.state.distanceM).toBeCloseTo(198, 0);

    engine.onSteps(183, T0 + 76_000);
    expect(engine.state.autoPaused).toBe(false);
  });

  it("does not count a manual pause and restarts the track after it", () => {
    const engine = RecordingEngine.start({ ...outdoor, autoPause: false }, T0);
    runStraight(engine, 0, 30, 3);
    engine.pause(T0 + 31_000);
    engine.onLocation(fix(60, 500));
    engine.resume(T0 + 90_000);
    engine.onLocation(fix(91, 1000));
    engine.onLocation(fix(92, 1003));
    engine.finish(T0 + 92_000);

    const view = engine.view(T0 + 200_000);
    expect(view.distanceM).toBeCloseTo(93, 0);
    expect(view.elapsedMs).toBe(92_000);
    expect(view.movingMs).toBe(33_000);
    expect(engine.state.pauses).toEqual([
      { startedAt: T0 + 31_000, endedAt: T0 + 90_000, auto: false },
    ]);
  });

  it("learns the stride from GPS running with steps", () => {
    const engine = RecordingEngine.start(outdoor, T0);
    engine.onSteps(0, T0);
    let metres = 0;
    for (let second = 0; second <= 400; second += 1) {
      engine.onLocation(fix(second, metres));
      engine.onSteps(second * 3, T0 + second * 1000 + 500);
      metres += 3.3;
    }
    expect(engine.calibratedStride()).toBeCloseTo(1.1, 1);
  });

  it("restores from a snapshot and keeps going", () => {
    const engine = RecordingEngine.start(outdoor, T0);
    runStraight(engine, 0, 60, 3);
    const restored = RecordingEngine.restore(
      JSON.parse(JSON.stringify(engine.state)),
    );
    runStraight(restored, 61, 120, 3, 183);
    expect(restored.view(T0 + 120_000).distanceM).toBeCloseTo(360, -1);
  });

  it("sanity: helper fixes are three metres apart", () => {
    expect(haversineM(fix(0, 0), fix(1, 3))).toBeCloseTo(3, 1);
  });
});

describe("barometer", () => {
  it("takes over the elevation from GPS with its own reference", () => {
    const engine = RecordingEngine.start(
      {
        environment: "trail",
        distanceMode: "time",
        strideM: 1,
        autoPause: false,
      },
      0,
    );
    engine.onAltitude(150);
    engine.onAltitude(151.5);
    expect(engine.state.elevation.gainM).toBe(0);
    engine.onAltitude(154);
    engine.onAltitude(149);
    expect(engine.state.elevation).toMatchObject({
      gainM: 4,
      lossM: 5,
      source: "baro",
    });
    engine.pause(1000);
    engine.onAltitude(170);
    expect(engine.state.elevation.gainM).toBe(4);
  });
});
