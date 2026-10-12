import { type ManualPlanPreview } from "@trefix/api-client";
import { describe, expect, it } from "vitest";

import {
  EMPTY_PREVIEW_EDITS,
  resolvePreview,
  toManualWeekOverrides,
  withWorkoutChanges,
  withWorkoutRemoved,
  type PreviewEdits,
} from "./preview-edits";

const workout = (
  id: string,
  weekNumber: number,
  orderInWeek: number,
  distanceKm: number,
) => ({
  id,
  type: "easy",
  phase: "base",
  weekNumber,
  dayOfWeek: orderInWeek,
  scheduledAt: "",
  orderInWeek,
  durationMinutes: 40,
  distanceKm,
  target: {},
  steps: [],
});

const preview = {
  weeks: [
    {
      weekNumber: 1,
      workouts: [workout("1-1", 1, 1, 5), workout("1-2", 1, 2, 8)],
    },
    { weekNumber: 2, workouts: [workout("2-1", 2, 1, 6)] },
  ],
} as unknown as ManualPlanPreview;

describe("preview edits", () => {
  it("applies overrides, removals and additions to what the user sees", () => {
    let edits = withWorkoutChanges(EMPTY_PREVIEW_EDITS, "1-1", 1, {
      distanceKm: 7,
    });
    edits = withWorkoutRemoved(edits, {
      id: "1-2",
      weekNumber: 1,
      orderInWeek: 2,
    });
    edits = {
      ...edits,
      additions: [
        {
          localId: "1",
          weekNumber: 2,
          type: "tempo",
          dayOfWeek: 4,
          distanceKm: 10,
          durationMinutes: 30,
        },
      ],
    };

    const resolved = resolvePreview(preview, edits);

    expect(resolved.resolvedWorkouts.get("1-1")?.distanceKm).toBe(7);
    expect(resolved.resolvedWorkouts.has("1-2")).toBe(false);
    expect(resolved.additionsByWeek.get(2)?.[0]).toMatchObject({
      id: "new:1",
      distanceKm: 10,
      durationMinutes: 30,
    });
    expect(resolved.totalDistance).toBe(7 + 6 + 10);
  });

  it("edits and removes an addition by its local id without touching overrides", () => {
    let edits: PreviewEdits = {
      ...EMPTY_PREVIEW_EDITS,
      additions: [
        {
          localId: "3",
          weekNumber: 1,
          type: "easy",
          dayOfWeek: 2,
          durationMinutes: 30,
        },
      ],
    };
    edits = withWorkoutChanges(edits, "new:3", 1, { distanceKm: 4 });
    expect(edits.additions[0]).toMatchObject({ distanceKm: 4 });
    expect(edits.overrides).toEqual({});

    edits = withWorkoutRemoved(edits, {
      id: "new:3",
      weekNumber: 1,
      orderInWeek: 1000,
    });
    expect(edits.additions).toEqual([]);
    expect(edits.removals).toEqual([]);
  });

  it("forgets the overrides of a removed workout and does not remove it twice", () => {
    let edits = withWorkoutChanges(EMPTY_PREVIEW_EDITS, "2-1", 2, {
      durationMinutes: 50,
    });
    edits = withWorkoutRemoved(edits, {
      id: "2-1",
      weekNumber: 2,
      orderInWeek: 1,
    });
    edits = withWorkoutRemoved(edits, {
      id: "2-1",
      weekNumber: 2,
      orderInWeek: 1,
    });

    expect(edits.overrides).toEqual({});
    expect(toManualWeekOverrides(edits)).toEqual([
      {
        weekNumber: 2,
        workoutOverrides: [],
        removedWorkoutIds: ["2-1"],
        newWorkouts: [],
      },
    ]);
  });
});
