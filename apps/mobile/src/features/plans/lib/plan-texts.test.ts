import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
}));

const { getMainCopy } = await import("../../../locales");
const {
  adaptationReason,
  adaptationTitle,
  goalTitle,
  keySessionLabel,
  phaseTitle,
  planTitle,
} = await import("./plan-texts");

const ru = getMainCopy("ru");
const en = getMainCopy("en");

const goal = (
  patch: Partial<NonNullable<Parameters<typeof goalTitle>[0]>>,
) => ({
  type: "prepare_for_race",
  target: null,
  description: null,
  targetDate: null,
  ...patch,
});

const target = {
  distanceMeters: null,
  finishTimeSec: null,
  runsPerWeek: null,
  weightKg: null,
};

describe("goalTitle", () => {
  it("formats a race target in the app language", () => {
    const race = goal({
      target: { ...target, distanceMeters: 21097.5, finishTimeSec: 6600 },
    });
    expect(goalTitle(race, ru, "ru")).toBe("21,1 км · 1:50:00");
    expect(goalTitle(race, en, "en")).toBe("21.1 km · 1:50:00");
  });

  it("pluralizes runs per week", () => {
    const habit = goal({ target: { ...target, runsPerWeek: 3 } });
    expect(goalTitle(habit, ru, "ru")).toBe("3 тренировки в неделю");
    expect(goalTitle(habit, en, "en")).toBe("3 runs a week");
  });

  it("keeps the user's own text of a custom goal", () => {
    expect(
      goalTitle(goal({ description: "Пробежать с сыном" }), en, "en"),
    ).toBe("Пробежать с сыном");
  });

  it("falls back to the goal type label", () => {
    expect(goalTitle(goal({}), ru, "ru")).toBe(
      ru.plan.creation.goalTypes.prepare_for_race,
    );
  });
});

describe("planTitle", () => {
  it("prefers the name given by the user", () => {
    expect(planTitle({ name: "Осень", goal: goal({}) }, ru, "ru")).toBe(
      "Осень",
    );
  });

  it("uses the generic title without a name and a goal", () => {
    expect(planTitle({ name: null, goal: null }, ru, "ru")).toBe(
      ru.plans.untitled,
    );
  });
});

describe("plan codes", () => {
  it("translates phases, key sessions and adaptations", () => {
    expect(phaseTitle("build", en)).toBe(
      en.plan.creation.preview.phaseTitles.BUILD,
    );
    expect(keySessionLabel({ type: "tempo", distanceKm: 8.4 }, ru)).toBe(
      `${ru.plan.creation.workoutTypes.tempo} 8 км`,
    );
    expect(adaptationTitle("REDUCE_VOLUME", ru)).toBe("Снижен объём");
    expect(adaptationTitle("SOMETHING_NEW", ru)).toBe(
      ru.plan.adaptations.types.default,
    );
  });

  it("shows coach text as is and hides unknown codes", () => {
    expect(adaptationReason("heart_rate_zones_changed", ru)).toBe(
      "Изменились пульсовые зоны",
    );
    expect(adaptationReason("Легче после болезни", ru)).toBe(
      "Легче после болезни",
    );
    expect(adaptationReason("unknown_code", ru)).toBeNull();
  });
});
