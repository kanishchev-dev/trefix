import { describe, expect, it } from "vitest";

import { estimatedPaceSec, goalPace } from "./goal-estimate";

describe("goal estimate", () => {
  it("uses 6:00 /km for an easy run when the threshold is unknown", () => {
    expect(estimatedPaceSec("easy", null)).toBe(360);
  });

  it("scales the threshold pace by the workout type", () => {
    expect(estimatedPaceSec("easy", 300)).toBe(375);
    expect(estimatedPaceSec("interval", 300)).toBe(288);
  });

  it("builds the corridor of a distance in a time limit", () => {
    expect(goalPace(8, 50)).toEqual({ pace: 375, min: 370, max: 380 });
    expect(goalPace(0, 50)).toBeNull();
  });
});
