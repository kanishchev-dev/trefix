import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
}));

const { isCreationStepValid } = await import("./plan-creation-flow");
const { INITIAL_PLAN_CREATION_DRAFT } = await import("./plan-creation-types");

const draft = INITIAL_PLAN_CREATION_DRAFT;

describe("isCreationStepValid", () => {
  it("needs at least one training day on the schedule step", () => {
    expect(isCreationStepValid("schedule", draft)).toBe(true);
    expect(
      isCreationStepValid("schedule", {
        ...draft,
        schedule: { ...draft.schedule, trainingDays: [] },
      }),
    ).toBe(false);
  });

  it("keeps the plan length within the manual plan limits", () => {
    const withWeeks = (totalWeeks: number) => ({
      ...draft,
      structure: { ...draft.structure, totalWeeks },
    });
    expect(isCreationStepValid("structure", withWeeks(8))).toBe(true);
    expect(isCreationStepValid("structure", withWeeks(3))).toBe(false);
    expect(isCreationStepValid("structure", withWeeks(17))).toBe(false);
  });

  it("requires a description for a custom goal", () => {
    const custom = (description: string) => ({
      ...draft,
      goal: { type: "custom" as const, description },
    });
    expect(isCreationStepValid("goalSetup", custom("Run with my kids"))).toBe(
      true,
    );
    expect(isCreationStepValid("goalSetup", custom("   "))).toBe(false);
  });

  it("lets the optional metrics step pass", () => {
    expect(isCreationStepValid("metrics", draft)).toBe(true);
  });
});
