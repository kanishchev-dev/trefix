import { describe, expect, it } from "vitest";

import type { PlanDiff } from "@trefix/api-client";

import {
  adjustmentText,
  buildDiffSummary,
  isEmptyDiff,
  workoutFieldChanges,
} from "./plan-diff";

const dictionary: Record<string, string> = {
  "userPlans.diff.adjustment.LONG_RUN_CAPPED": "Long run capped at {km} km",
  "userPlans.diff.adjustment.generic": "Adjusted",
  "userPlans.diff.peakVolume": "Peak {before} → {after}",
  "userPlans.diff.totalWeeks": "Weeks {before} → {after}",
  "userPlans.diff.threshold": "Threshold {before} → {after}",
  "userPlans.diff.fields.distanceKm": "distance",
};

const t = (key: string, params?: Record<string, string | number>): string => {
  const template = dictionary[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params?.[name] ?? `{${name}}`),
  );
};

const emptySummary = {
  weeklyVolumeKm: { before: [], after: [] },
  peakWeekKm: { before: 40, after: 40 },
  longestRunKm: { before: 18, after: 18 },
  thresholdPace: { before: 290, after: 290 },
  totalWeeks: { before: 10, after: 10 },
  adjustments: [],
};

describe("plan diff", () => {
  it("summarises only what changed", () => {
    const diff: PlanDiff = {
      summary: {
        ...emptySummary,
        peakWeekKm: { before: 40, after: 44.44 },
        totalWeeks: { before: 10, after: 12 },
        thresholdPace: { before: 300, after: 290 },
        adjustments: [{ code: "LONG_RUN_CAPPED", params: { km: 21.06 } }],
      },
      weeks: [],
    };

    expect(buildDiffSummary(diff, t).map((line) => line.text)).toEqual([
      "Threshold 5:00 → 4:50",
      "Long run capped at 21.1 km",
      "Peak 40 → 44.4",
      "Weeks 10 → 12",
    ]);
  });

  it("falls back to the generic text for unknown adjustment codes", () => {
    expect(adjustmentText({ code: "SOMETHING_NEW" }, t)).toBe("Adjusted");
  });

  it("describes field changes and detects empty diffs", () => {
    expect(
      workoutFieldChanges(
        { key: "w1", change: "modified", fields: { distanceKm: [8, 10] } },
        t,
        "en",
      ),
    ).toEqual(["distance: 8 → 10"]);
    expect(isEmptyDiff({ summary: emptySummary, weeks: [] })).toBe(true);
  });
});
