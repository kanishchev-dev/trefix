import { describe, expect, it } from "vitest";

import type { AdminCalendarWorkout } from "@trefix/api-client";

import {
  getCreateFormDefaults,
  getEditFormDefaults,
  toCreateInput,
  toUpdateInput,
  workoutFormSchema,
} from "./workout-form";

const workout: AdminCalendarWorkout = {
  id: "workout-1",
  athleteId: "athlete-1",
  planId: "plan-1",
  scheduledAt: new Date(2026, 9, 7, 6, 30).toISOString(),
  type: "tempo",
  phase: "build",
  status: "planned",
  durationMinutes: 45,
  distanceKm: 8,
  title: "Tempo",
  source: "plan",
  hasActual: false,
  completedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("workout form", () => {
  it("prefills a new workout on the selected day", () => {
    const values = getCreateFormDefaults(new Date(2026, 9, 7));

    expect(values).toMatchObject({
      date: "2026-10-07",
      time: "07:00",
      type: "easy",
      status: "planned",
    });
    expect(workoutFormSchema.safeParse(values).success).toBe(true);
  });

  it("builds a create payload and omits an empty title", () => {
    const input = toCreateInput({
      ...getCreateFormDefaults(new Date(2026, 9, 7)),
      title: "  ",
    });

    expect(input.scheduledAt).toBe(new Date(2026, 9, 7, 7, 0).toISOString());
    expect(input.title).toBeUndefined();
  });

  it("sends only changed fields on update", () => {
    const values = {
      ...getEditFormDefaults(workout),
      time: "08:00",
      distanceKm: 10,
    };

    expect(toUpdateInput(values, workout)).toEqual({
      scheduledAt: new Date(2026, 9, 7, 8, 0).toISOString(),
      distanceKm: 10,
    });
  });

  it("sends nothing when the form is unchanged", () => {
    expect(toUpdateInput(getEditFormDefaults(workout), workout)).toEqual({});
  });

  it.each([
    ["time", { time: "25:00" }],
    ["duration", { durationMinutes: 0 }],
    ["distance", { distanceKm: 101 }],
    ["date", { date: "2026-02-30" }],
  ])("rejects an invalid %s", (_label, override) => {
    const result = workoutFormSchema.safeParse({
      ...getEditFormDefaults(workout),
      ...override,
    });

    expect(result.success).toBe(false);
  });
});
