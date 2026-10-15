import { describe, expect, it, vi } from "vitest";

import { type PlanOverview, type PlanWorkoutItem } from "@trefix/api-client";

vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
}));

const {
  detailsWeekStats,
  latestAdaptation,
  loadLandscape,
  phaseGroups,
  planWeekStats,
  weekDays,
  weekIntensity,
} = await import("./active-plan-view");

const week = (
  weekNumber: number,
  phase: string,
  status: "completed" | "current" | "upcoming",
  plannedDistance: number,
  keyTypes: string[] = [],
): PlanOverview["weeks"][number] =>
  ({
    id: `w${weekNumber}`,
    weekNumber,
    phase,
    status,
    plannedDistance,
    plannedWorkoutsCount: 3,
    keySessions: keyTypes.map((type) => ({ type, distanceKm: 8 })),
  }) as PlanOverview["weeks"][number];

const workout = (
  patch: Partial<PlanWorkoutItem> & { scheduledAt: string },
): PlanWorkoutItem => ({
  id: patch.scheduledAt,
  weekNumber: 1,
  orderInWeek: 0,
  type: "easy",
  status: "planned",
  durationMinutes: 40,
  distanceKm: 8,
  target: {},
  actual: null,
  ...patch,
});

describe("planWeekStats", () => {
  it("counts done, missed and the run distance of a week", () => {
    const [stats] = planWeekStats(
      [week(1, "BASE", "completed", 24, ["tempo", "tempo", "long_run"])],
      [
        workout({
          scheduledAt: "2026-10-05",
          status: "completed",
          actual: { actualDistanceKm: 8.4 },
        }),
        workout({ scheduledAt: "2026-10-07", status: "skipped" }),
        workout({ scheduledAt: "2026-10-09", status: "cancelled" }),
        workout({ scheduledAt: "2026-10-12", weekNumber: 2 }),
      ],
    );
    expect(stats).toMatchObject({
      plannedKm: 24,
      actualKm: 8.4,
      done: 1,
      missed: 1,
      keyTypes: ["tempo", "long_run"],
    });
    expect(weekIntensity(stats)).toBe(3);
  });
});

describe("phaseGroups", () => {
  it("joins consecutive weeks of a phase and marks how far the plan is", () => {
    const groups = phaseGroups(
      planWeekStats([
        week(1, "BASE", "completed", 20),
        week(2, "BASE", "completed", 22),
        week(3, "BUILD", "current", 30),
        week(4, "BUILD", "upcoming", 32),
        week(5, "TAPER", "upcoming", 18),
      ]),
    );
    expect(
      groups.map(({ phase, from, to, plannedKm, state }) => ({
        phase,
        from,
        to,
        plannedKm,
        state,
      })),
    ).toEqual([
      { phase: "BASE", from: 1, to: 2, plannedKm: 42, state: "done" },
      { phase: "BUILD", from: 3, to: 4, plannedKm: 62, state: "current" },
      { phase: "TAPER", from: 5, to: 5, plannedKm: 18, state: "upcoming" },
    ]);
  });
});

describe("weekDays", () => {
  it("lays out seven days from the week start with their state", () => {
    const days = weekDays(
      "2026-10-12",
      [
        workout({
          scheduledAt: "2026-10-12",
          status: "completed",
          actual: { actualDistanceKm: 8.3 },
        }),
        workout({ scheduledAt: "2026-10-13", status: "skipped" }),
        workout({ scheduledAt: "2026-10-14", type: "tempo" }),
      ],
      "2026-10-14",
    );
    expect(days).toHaveLength(7);
    expect(days.map((day) => day.kind)).toEqual([
      "done",
      "missed",
      "planned",
      "rest",
      "rest",
      "rest",
      "rest",
    ]);
    expect(days[0]).toMatchObject({ weekday: 0, km: 8.3 });
    expect(days[2]).toMatchObject({ isToday: true, type: "tempo", km: 8 });
  });
});

describe("loadLandscape", () => {
  it("scales the weeks to the biggest one", () => {
    const bars = loadLandscape(
      planWeekStats([
        week(1, "BASE", "completed", 20),
        week(2, "BUILD", "current", 40),
      ]),
    );
    expect(bars.map((bar) => bar.ratio)).toEqual([0.5, 1]);
  });
});

describe("latestAdaptation", () => {
  it("picks the newest change", () => {
    expect(
      latestAdaptation([
        { id: "a", type: "MOVE", createdAt: "2026-10-01T10:00:00Z" },
        { id: "b", type: "MOVE", createdAt: "2026-10-03T10:00:00Z" },
      ])?.id,
    ).toBe("b");
    expect(latestAdaptation([])).toBeNull();
  });
});

describe("detailsWeekStats", () => {
  const details = {
    weeks: [
      {
        weekNumber: 1,
        phase: "BASE",
        workouts: [
          { type: "easy", distanceKm: 6 },
          { type: "tempo", distanceKm: 8 },
        ],
      },
      { weekNumber: 2, phase: "BASE", workouts: [] },
    ],
    workouts: [
      workout({
        scheduledAt: "2026-10-05",
        status: "completed",
        actual: { actualDistanceKm: 7 },
      }),
      workout({ scheduledAt: "2026-10-07", status: "skipped" }),
      workout({ scheduledAt: "2026-10-12", weekNumber: 2 }),
    ],
  } as unknown as Parameters<typeof detailsWeekStats>[0];

  it("takes a draft's relative workouts, all ahead", () => {
    const [first] = detailsWeekStats(details, "relative");
    expect(first).toMatchObject({
      status: "upcoming",
      plannedKm: 14,
      workouts: 2,
      keyTypes: ["tempo"],
    });
  });

  it("marks reached history weeks and leaves the unreached ones ahead", () => {
    const [first, second] = detailsWeekStats(details, "history");
    expect(first).toMatchObject({
      status: "completed",
      actualKm: 7,
      done: 1,
      missed: 1,
    });
    expect(second).toMatchObject({ status: "upcoming", missed: 0 });
  });
});
