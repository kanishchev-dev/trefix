import { describe, expect, it } from "vitest";

import type { EngineState, EngineView } from "./engine/types";
import { lastUnitPace, pauseDurationMs } from "./recording-metrics";

const view = (movingMs: number, distanceM: number): EngineView =>
  ({
    movingMs,
    distanceM,
    avgPaceSecPerKm: distanceM >= 50 ? movingMs / distanceM : null,
  }) as EngineView;

describe("lastUnitPace", () => {
  it("is the average pace before the first kilometre", () => {
    expect(lastUnitPace(null, view(120_000, 400))).toBe(300);
  });

  it("takes the pace of the last kilometre from the timeline", () => {
    const state = {
      timeline: [
        [0, 0, 0],
        [300_000, 1000, 0],
        [540_000, 1800, 0],
        [600_000, 2000, 0],
      ],
    } as unknown as EngineState;
    // 2000 m now, the last kilometre started at 1000 m (300 s): 300 s for 1000 m.
    expect(lastUnitPace(state, view(600_000, 2000))).toBe(300);
  });
});

describe("pauseDurationMs", () => {
  it("counts the open pause only", () => {
    const state = {
      pauses: [
        { startedAt: 0, endedAt: 1000, auto: false },
        { startedAt: 5000, endedAt: null, auto: false },
      ],
    } as unknown as EngineState;
    expect(pauseDurationMs(state, 7000)).toBe(2000);
  });
});
