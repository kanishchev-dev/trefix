import { describe, expect, it } from "vitest";

import { progressFixture } from "./__fixtures__/progress-snapshots";
import {
  bucketsFor,
  comparisonFor,
  highlightsFor,
  planExecutionFor,
  sectionLayoutFor,
  totalsFor,
  weekStartOf,
  workoutsFor,
} from "./progress-selectors";

const active = progressFixture("activePlan");
const round = (value: number) => Math.round(value * 10) / 10;

describe("progress totals", () => {
  it("counts only done workouts of the current week and month", () => {
    expect(weekStartOf("2026-10-15")).toBe("2026-10-12");
    const week = totalsFor(active, "week");
    expect(round(week.distanceKm)).toBe(31.3);
    expect(week.count).toBe(3);
    const month = totalsFor(active, "month");
    expect(round(month.distanceKm)).toBe(70.8);
    expect(month.count).toBe(8);
  });

  it("adds stored months and years to the current month", () => {
    expect(round(totalsFor(active, "year").distanceKm)).toBe(757.8);
    expect(round(totalsFor(active, "all").distanceKm)).toBe(2792.8);
  });

  it("chart buckets sum up to the totals", () => {
    for (const period of ["week", "month", "year", "all"] as const) {
      const sum = bucketsFor(active, period, "distance").reduce(
        (a, b) => a + (b.value ?? 0),
        0,
      );
      expect(round(sum)).toBe(round(totalsFor(active, period).distanceKm));
    }
  });

  it("marks future days and missing measurements apart from zeros", () => {
    const month = bucketsFor(active, "month", "distance");
    expect(month).toHaveLength(31);
    expect(month[1]?.state).toBe("value");
    expect(month[1]?.value).toBe(0);
    expect(month[15]?.state).toBe("future");
    const partial = progressFixture("partialMetrics");
    expect(totalsFor(partial, "month").elevationM).toBeNull();
    expect(bucketsFor(partial, "month", "elevation")[0]?.state).toBe("noData");
    expect(comparisonFor(partial, "month", "elevation")).toBeNull();
  });
});

describe("progress comparisons and highlights", () => {
  it("compares with the same stretch of the previous period", () => {
    expect(round(comparisonFor(active, "month", "distance")?.diff ?? 0)).toBe(
      18.5,
    );
    expect(comparisonFor(active, "all", "distance")).toBeNull();
  });

  it("hides heart rate when it was not measured", () => {
    const withHr = highlightsFor(active, "month");
    expect(withHr?.main.kind).toBe("pace");
    expect(withHr?.items.map((item) => item.kind)).toEqual([
      "longest",
      "heartRate",
    ]);
    const partial = highlightsFor(progressFixture("partialMetrics"), "month");
    expect(partial?.items.map((item) => item.kind)).toEqual([
      "longest",
      "record",
    ]);
  });
});

describe("plan execution and layout", () => {
  it("shows execution only with a plan and never a fake percent", () => {
    expect(planExecutionFor(active, "month")?.percent).toBe(88);
    expect(
      planExecutionFor(progressFixture("activityOnly"), "month"),
    ).toBeNull();
  });

  it("drops missed workouts without a plan", () => {
    const free = workoutsFor(progressFixture("activityOnly"), "month", 10);
    expect(free.every((workout) => workout.status === "free")).toBe(true);
  });

  it("shows tabs only when both overview and analytics have content", () => {
    expect(sectionLayoutFor(active)).toEqual({ empty: false, showTabs: true });
    expect(sectionLayoutFor(progressFixture("overviewOnly")).showTabs).toBe(
      false,
    );
    expect(sectionLayoutFor(progressFixture("empty"))).toEqual({
      empty: true,
      showTabs: false,
    });
  });
});
