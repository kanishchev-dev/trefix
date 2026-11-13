import { describe, expect, it } from "vitest";

import type { TrainingWorkout } from "@trefix/api-client";

import { goalFromDraft, goalFromWorkout, goalSteps } from "./run-goal";

describe("run goal", () => {
  it("runs a time goal as one timed step", () => {
    const goal = goalFromDraft(
      { goal: "duration", minutes: 50, distance: 5, timeLimitMin: null },
      "metric",
    );
    expect(goal).toEqual({
      kind: "duration",
      durationSec: 3000,
      distanceM: null,
      timeLimitSec: null,
    });
    expect(goalSteps(goal!, "easy")).toEqual([
      expect.objectContaining({
        kind: "steady",
        durationSec: 3000,
        distanceM: null,
        targetPace: null,
      }),
    ]);
  });

  it("builds the pace corridor of a distance in a time limit", () => {
    const goal = goalFromDraft(
      { goal: "distance", minutes: 45, distance: 8, timeLimitMin: 50 },
      "metric",
    );
    expect(goalSteps(goal!, "tempo")).toEqual([
      expect.objectContaining({
        kind: "work",
        distanceM: 8000,
        targetPace: { minSecPerKm: 370, maxSecPerKm: 380 },
      }),
    ]);
  });

  it("has no goal without one", () => {
    expect(
      goalFromDraft(
        { goal: "none", minutes: 45, distance: 5, timeLimitMin: null },
        "metric",
      ),
    ).toBeNull();
  });

  it("reads the goal of a workout added by hand only", () => {
    const own = {
      planId: null,
      durationMinutes: 50,
      distanceKm: 0,
      target: { goal: "duration" },
    } as unknown as TrainingWorkout;
    expect(goalFromWorkout(own)?.durationSec).toBe(3000);
    expect(
      goalFromWorkout({ ...own, planId: "plan-1" } as TrainingWorkout),
    ).toBeNull();
  });
});
