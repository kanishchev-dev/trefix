import { describe, expect, it } from "vitest";

import type { PlanDetails } from "@workspace/api-client";

import { buildPlanWeeks, isDatedWorkoutEditable } from "./plan-weeks";

const base = {
  id: "plan-1",
  name: "Plan",
  creationSource: "manual",
  goal: { type: null, title: null, targetDate: null },
  totalWeeks: 2,
  updatedAt: "2026-10-01T00:00:00.000Z",
  notes: null,
  version: 1,
  config: { goal: {}, schedule: {}, structure: {} },
  metricsSnapshot: null,
} satisfies Partial<PlanDetails>;

const relative = (key: string, dayOfWeek: number, distanceKm: number) => ({
  key,
  dayOfWeek,
  orderInWeek: 1,
  type: "easy",
  phase: "base",
  durationMinutes: 30,
  distanceKm,
  target: {},
  steps: [],
});

const dated = (
  id: string,
  weekNumber: number,
  scheduledAt: string,
  status = "planned",
) => ({
  id,
  weekNumber,
  orderInWeek: 1,
  scheduledAt,
  type: "easy",
  status,
  durationMinutes: 30,
  distanceKm: 5,
  target: {},
  actual: null,
});

describe("plan weeks", () => {
  it("orders draft workouts by weekday and sums the distance", () => {
    const weeks = buildPlanWeeks({
      ...base,
      status: "draft",
      weeks: [
        {
          weekNumber: 1,
          phase: "base",
          workouts: [relative("b", 4, 8), relative("a", 1, 5.5)],
        },
      ],
      workouts: [],
    } as PlanDetails);

    expect(
      weeks[0].workouts.map((workout) =>
        workout.kind === "relative" ? workout.key : "",
      ),
    ).toEqual(["a", "b"]);
    expect(weeks[0].distanceKm).toBe(13.5);
  });

  it("groups dated workouts by week, including weeks without a record", () => {
    const weeks = buildPlanWeeks({
      ...base,
      status: "active",
      weeks: [{ weekNumber: 1, phase: "base", workoutIds: ["w2", "w1"] }],
      workouts: [
        dated("w2", 1, "2026-10-08T00:00:00.000Z"),
        dated("w1", 1, "2026-10-06T00:00:00.000Z"),
        dated("w3", 2, "2026-10-13T00:00:00.000Z"),
      ],
    } as PlanDetails);

    expect(weeks.map((week) => week.weekNumber)).toEqual([1, 2]);
    expect(
      weeks[0].workouts.map((workout) =>
        workout.kind === "dated" ? workout.id : "",
      ),
    ).toEqual(["w1", "w2"]);
  });

  it("allows editing only planned workouts from today on", () => {
    expect(
      isDatedWorkoutEditable(
        dated("a", 1, "2026-10-09T00:00:00.000Z"),
        "2026-10-09",
      ),
    ).toBe(true);
    expect(
      isDatedWorkoutEditable(
        dated("a", 1, "2026-10-08T00:00:00.000Z"),
        "2026-10-09",
      ),
    ).toBe(false);
    expect(
      isDatedWorkoutEditable(
        dated("a", 1, "2026-10-10T00:00:00.000Z", "completed"),
        "2026-10-09",
      ),
    ).toBe(false);
  });
});
