import { describe, expect, it } from "vitest";

import { reconcileStartChoice } from "./start-plan";

const options = (raceFits: boolean) =>
  ({
    today: "2026-10-12",
    recommended: raceFits ? "race_aligned" : "next_monday",
    options: [
      { kind: "today", startDate: "2026-10-12", endDate: "2026-12-06" },
      { kind: "next_monday", startDate: "2026-10-19", endDate: "2026-12-13" },
      {
        kind: "race_aligned",
        startDate: "2026-10-26",
        endDate: "2026-12-20",
        goalTargetDate: "2026-12-20",
        fits: raceFits,
      },
    ],
  }) as never;

describe("reconcileStartChoice", () => {
  it("keeps a custom date whatever the options are", () => {
    const custom = { kind: "custom" as const, startDate: "2026-11-02" };
    expect(reconcileStartChoice(custom, options(true))).toBe(custom);
  });

  it("keeps the chosen option and takes its new dates", () => {
    const current = { kind: "next_monday" as const, startDate: "2026-10-12" };
    expect(reconcileStartChoice(current, options(true))).toEqual({
      kind: "next_monday",
      startDate: "2026-10-19",
      goalTargetDate: undefined,
    });
  });

  it("falls back to the recommendation when the chosen option no longer fits", () => {
    const current = { kind: "race_aligned" as const, startDate: "2026-10-26" };
    expect(reconcileStartChoice(current, options(false))).toMatchObject({
      kind: "next_monday",
    });
  });

  it("starts from the recommendation without a previous choice", () => {
    expect(reconcileStartChoice(null, options(true))).toMatchObject({
      kind: "race_aligned",
      goalTargetDate: "2026-12-20",
    });
  });
});
