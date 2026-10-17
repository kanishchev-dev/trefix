import { describe, expect, it } from "vitest";

import {
  adherenceInsight,
  fitnessInsight,
  planDropInsight,
  racesInsight,
  regularityInsight,
  runnersInsight,
  safetyInsight,
} from "./insights";

const kpi = { value: 0, previous: 0, deltaPct: null, spark: [] };

describe("analytics insights", () => {
  it("prefers a growth streak over the change of the period", () => {
    expect(runnersInsight({ ...kpi, growthWeeks: 3, deltaPct: -5 })).toEqual({
      key: "growingWeeks",
      params: { weeks: 3 },
    });
    expect(runnersInsight({ ...kpi, growthWeeks: 0, deltaPct: -5 }).key).toBe(
      "belowLast",
    );
  });

  it("judges plan adherence", () => {
    expect(adherenceInsight({ ...kpi, value: 84 }).key).toBe("adherenceHigh");
    expect(adherenceInsight({ ...kpi, value: 70, deltaPct: -4 }).key).toBe(
      "adherenceFalling",
    );
  });

  it("reports form growth only with enough athletes", () => {
    const base = {
      athletes: 10,
      improved: 6,
      stable: 3,
      declined: 1,
      fitnessChangeMedianPct: 4,
      historical: true,
      series: [],
    };
    expect(
      fitnessInsight({ ...base, thresholdPaceChangeMedianSec: -9 }),
    ).toEqual({ key: "fitnessFaster", params: { seconds: 9 } });
    expect(
      fitnessInsight({
        ...base,
        athletes: 0,
        thresholdPaceChangeMedianSec: -9,
      }),
    ).toBeNull();
  });

  it("counts races within or faster than the target", () => {
    expect(
      racesInsight([
        { bucket: "faster_3plus", count: 2 },
        { bucket: "within_3", count: 4 },
        { bucket: "slower_3_10", count: 3 },
        { bucket: "slower_10plus", count: 1 },
      ]),
    ).toEqual({ key: "races", params: { share: 60 } });
  });

  it("warns about overload above the threshold", () => {
    expect(
      safetyInsight({ currentShare: 12, historical: true, series: [] })?.key,
    ).toBe("overloadHigh");
    expect(
      safetyInsight({ currentShare: 4, historical: true, series: [] })?.key,
    ).toBe("overloadNormal");
  });

  it("finds the weakest week of plans", () => {
    const weeks = [
      { planWeek: 1, adherencePct: 90, workouts: 40 },
      { planWeek: 2, adherencePct: 70, workouts: 40 },
      { planWeek: 3, adherencePct: 85, workouts: 40 },
      { planWeek: 4, adherencePct: 20, workouts: 2 },
    ];
    expect(planDropInsight(weeks)).toEqual({
      key: "planDrop",
      params: { week: 2, share: 70 },
    });
  });

  it("shares steady runners of the last 8 weeks", () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      weeks: index + 1,
      users: 10,
    }));
    expect(regularityInsight(rows)).toEqual({
      key: "regularity",
      params: { share: 38 },
    });
  });
});
