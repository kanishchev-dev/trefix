import { describe, expect, it } from "vitest";

import { canDoubleUp, maxSessionsPerWeek } from "./schedule-rules";

describe("schedule rules", () => {
  it("allows doubles only at the advanced level", () => {
    expect(canDoubleUp("advanced")).toBe(true);
    expect(canDoubleUp("intermediate")).toBe(false);
  });

  it("limits sessions by days, twice the days with doubles, never above 7", () => {
    expect(maxSessionsPerWeek(3, false)).toBe(3);
    expect(maxSessionsPerWeek(3, true)).toBe(6);
    expect(maxSessionsPerWeek(5, true)).toBe(7);
  });
});
