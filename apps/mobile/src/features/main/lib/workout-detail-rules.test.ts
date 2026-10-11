import { describe, expect, it } from "vitest";

import { getWorkoutActions, parseCompletionForm } from "./workout-detail-rules";

describe("getWorkoutActions", () => {
  const planned = { status: "planned", type: "easy", planId: "p1" };

  it("lets a future workout of the active plan be edited, not completed", () => {
    const actions = getWorkoutActions(
      planned,
      "2026-10-20",
      "2026-10-11",
      "p1",
      false,
    );
    expect(actions).toMatchObject({
      isEditable: true,
      isLocked: false,
      canComplete: false,
      canRecord: false,
    });
  });

  it("locks the past of the active plan but keeps manual completion", () => {
    const actions = getWorkoutActions(
      planned,
      "2026-10-10",
      "2026-10-11",
      "p1",
      false,
    );
    expect(actions).toMatchObject({
      isEditable: false,
      isLocked: true,
      canComplete: true,
    });
  });

  it("allows recording only today's run while the tracker is idle", () => {
    expect(
      getWorkoutActions(planned, "2026-10-11", "2026-10-11", "p1", false)
        .canRecord,
    ).toBe(true);
    expect(
      getWorkoutActions(planned, "2026-10-11", "2026-10-11", "p1", true)
        .canRecord,
    ).toBe(false);
    expect(
      getWorkoutActions(
        { ...planned, type: "rest" },
        "2026-10-11",
        "2026-10-11",
        "p1",
        false,
      ).canRecord,
    ).toBe(false);
  });

  it("lets a skipped workout be completed manually", () => {
    expect(
      getWorkoutActions(
        { ...planned, status: "skipped" },
        "2026-10-10",
        "2026-10-11",
        "p1",
        false,
      ).canComplete,
    ).toBe(true);
  });
});

describe("parseCompletionForm", () => {
  const form = {
    distanceKm: "10.5",
    durationMinutes: "55",
    heartRate: "",
    rpe: "7",
    notes: "  ok ",
  };

  it("builds the payload and drops empty optional fields", () => {
    expect(parseCompletionForm(form)).toEqual({
      ok: true,
      input: {
        actualDistanceKm: 10.5,
        actualDurationMinutes: 55,
        actualAverageHeartRate: undefined,
        rpe: 7,
        notes: "ok",
      },
    });
  });

  it("reports the invalid field", () => {
    expect(parseCompletionForm({ ...form, distanceKm: "0" })).toEqual({
      ok: false,
      field: "distance",
    });
    expect(parseCompletionForm({ ...form, durationMinutes: "x" })).toEqual({
      ok: false,
      field: "duration",
    });
  });
});
