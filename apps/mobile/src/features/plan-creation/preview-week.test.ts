import { describe, expect, it } from "vitest";

const { buildPreviewWeek } = await import("./preview-week");

const workout = (id: string, dayOfWeek: number, distanceKm: number) =>
  ({ id, dayOfWeek, distanceKm, weekNumber: 1 }) as never;

describe("buildPreviewWeek", () => {
  const week = {
    weekNumber: 1,
    workouts: [workout("a", 2, 5), workout("b", 0, 8)],
  } as never;

  it("applies edits, appends additions and orders by day", () => {
    const resolved = new Map([
      ["a", workout("a", 2, 6)],
      ["b", workout("b", 0, 8)],
    ]);
    const view = buildPreviewWeek(
      week,
      resolved,
      [workout("new", 4, 3)],
      [0, 2, 4],
    );

    expect(view.workouts.map((item) => item.id)).toEqual(["b", "a", "new"]);
    expect(view.distanceKm).toBe(17);
  });

  it("drops removed workouts and suggests a free training day for a new one", () => {
    const resolved = new Map([["b", workout("b", 0, 8)]]);
    const view = buildPreviewWeek(week, resolved, [], [0, 2, 4]);

    expect(view.workouts.map((item) => item.id)).toEqual(["b"]);
    expect(view.freeDay).toBe(2);
  });

  it("falls back to any free weekday when all training days are taken", () => {
    const resolved = new Map([
      ["a", workout("a", 2, 5)],
      ["b", workout("b", 0, 8)],
    ]);
    expect(buildPreviewWeek(week, resolved, [], [0, 2]).freeDay).toBe(1);
  });
});
