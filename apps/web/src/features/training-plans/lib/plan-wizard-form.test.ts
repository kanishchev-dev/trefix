import { describe, expect, it } from "vitest";

import type {
  CurrentMetrics,
  PlanStartOption,
  RebuildPrefill,
} from "@workspace/api-client";

import {
  buildMetrics,
  getDefaultWizardValues,
  metricsFromCurrent,
  planWizardSchema,
  toCreateInput,
  toRebuildInput,
  validateSaveOptions,
  valuesFromRebuildPrefill,
} from "./plan-wizard-form";

const currentMetrics: CurrentMetrics = {
  thresholdPaceSecondsPerKm: { value: 290, source: "strava" },
  thresholdHeartRate: { value: null, source: "none" },
  maxHeartRate: { value: 188, source: "athlete_state" },
  restingHeartRate: { value: null, source: "none" },
  weeklyMileageKm: { value: 32.46, source: "strava" },
  longestRunKm: { value: 15, source: "strava" },
  recentResult: {
    value: { distance: "10k", timeSeconds: 2700, date: "2026-09-20" },
    source: "strava",
  },
};

const startOption: PlanStartOption = {
  kind: "next_monday",
  startDate: "2026-10-12",
  endDate: "2026-12-06",
};

describe("plan wizard form", () => {
  it("accepts the defaults", () => {
    expect(planWizardSchema.safeParse(getDefaultWizardValues()).success).toBe(
      true,
    );
  });

  it("rejects more sessions than training days and invalid goal values", () => {
    const result = planWizardSchema.safeParse({
      ...getDefaultWizardValues(),
      trainingDays: [0, 2],
      sessionsPerWeek: 3,
      goalTarget: { distanceMeters: "0.1" },
    });

    expect(result.success).toBe(false);
    const paths = result.success
      ? []
      : result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining(["sessionsPerWeek", "goalTarget.distanceMeters"]),
    );
  });

  it("prefills metrics from the current estimate", () => {
    const metrics = metricsFromCurrent(currentMetrics);

    expect(metrics).toMatchObject({
      thresholdPace: "4:50",
      maxHeartRate: "188",
      weeklyMileageKm: "32.5",
      recentDistance: "10k",
      recentTime: "45:00",
      recentDate: "2026-09-20",
    });
    expect(buildMetrics(metrics)).toEqual({
      thresholdPaceSecondsPerKm: 290,
      maxHeartRate: 188,
      weeklyMileageKm: 32.5,
      longestRunKm: 15,
      recentResult: { distance: "10k", timeSeconds: 2700, date: "2026-09-20" },
    });
  });

  it("builds a draft payload by default", () => {
    const input = toCreateInput(
      getDefaultWizardValues(),
      null,
      "Europe/Moscow",
    );

    expect(input).toMatchObject({
      goal: {
        type: "prepare_for_race",
        target: { distanceMeters: 10_000 },
        current: null,
      },
      schedule: { trainingDays: [0, 2, 5], workoutDurationMinutes: 45 },
      structure: { totalWeeks: 8, sessionsPerWeek: 3 },
      saveAsDraft: true,
      notes: null,
      timezone: "Europe/Moscow",
    });
    expect(input.start).toBeUndefined();
  });

  it("builds a start block and requires consent to replace the active plan", () => {
    const values = {
      ...getDefaultWizardValues(),
      saveMode: "start" as const,
      replaceActive: true,
    };

    expect(toCreateInput(values, startOption, "UTC").start).toEqual({
      startDate: "2026-10-12",
      goalTargetDate: undefined,
      replaceActive: true,
      timezone: "UTC",
    });
    expect(
      validateSaveOptions(
        { ...values, replaceActive: false },
        startOption,
        true,
      ),
    ).toBe("userPlans.wizard.errors.replaceActive");
    expect(validateSaveOptions(values, null, false)).toBe(
      "userPlans.wizard.errors.startOption",
    );
  });

  it("seeds a rebuild from the source plan and keeps the draft version for in-place updates", () => {
    const prefill: RebuildPrefill = {
      config: {
        goal: {
          type: "improve_race_result",
          target: { distanceMeters: 21_097, finishTimeSec: 6300 },
        },
        schedule: {
          trainingDays: [1, 3, 6],
          preferredLongRunDay: 6,
          workoutDurationMinutes: 50,
        },
        structure: {
          totalWeeks: 12,
          sessionsPerWeek: 3,
          focus: ["tempo", "unknown"],
        },
      },
      goalSuggestion: {
        targetDate: "2027-04-18",
        previousTargetDate: "2026-09-20",
        previousResult: null,
      },
      metrics: { previous: null, current: currentMetrics },
    };

    const values = valuesFromRebuildPrefill(prefill, "Spring half");

    expect(values).toMatchObject({
      goalType: "improve_race_result",
      goalTarget: { distanceMeters: "21.1", finishTimeSec: "1:45:00" },
      goalTargetDate: "2027-04-18",
      trainingDays: [1, 3, 6],
      preferredLongRunDay: 6,
      totalWeeks: 12,
      focus: ["tempo"],
      name: "Spring half",
    });
    expect(toRebuildInput(values, "in_place", null, "UTC", 7)).toMatchObject({
      target: "in_place",
      expectedVersion: 7,
    });
  });
});
