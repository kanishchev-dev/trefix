import { describe, expect, it } from "vitest";

import {
  formatGoalFields,
  parseGoal,
  parseGoalField,
  withRequiredGoalDefaults,
} from "./goal-fields";

describe("goal fields", () => {
  it("converts typed values into API units", () => {
    expect(parseGoalField("distanceMeters", "21.1")).toBe(21_100);
    expect(parseGoalField("finishTimeSec", "1:45:00")).toBe(6300);
    expect(parseGoalField("paceSecondsPerKm", "5:30")).toBe(330);
    expect(parseGoalField("weightKg", "72,5")).toBe(72.5);
    expect(parseGoalField("challengeMetric", "runs_count")).toBe("runs_count");
  });

  it("treats empty as unset and out-of-range as invalid", () => {
    expect(parseGoalField("distanceMeters", "  ")).toBeUndefined();
    expect(parseGoalField("distanceMeters", "0.1")).toBeNull();
    expect(parseGoalField("runsPerWeek", "2.5")).toBeNull();
    expect(parseGoalField("challengeMetric", "unknown")).toBeNull();
  });

  it("formats API values back for editing", () => {
    expect(
      formatGoalFields({
        distanceMeters: 42_195,
        finishTimeSec: 14_400,
        unknown: 1,
      }),
    ).toEqual({
      distanceMeters: "42.2",
      finishTimeSec: "4:00:00",
    });
  });

  it("sends only the fields of the selected goal type", () => {
    const goal = parseGoal(
      "prepare_for_race",
      { distanceMeters: "10", weightKg: "70" },
      { finishTimeSec: "50:00" },
      "",
    );

    expect(goal.target).toEqual({ distanceMeters: 10_000 });
    expect(goal.current).toEqual({ finishTimeSec: 3000 });
    expect(goal.errors).toEqual({});
  });

  it("reports missing required groups and descriptions", () => {
    expect(
      parseGoal("improve_race_result", { distanceMeters: "10" }, {}, "").errors,
    ).toEqual({
      "target.finishTimeSec": "userPlans.goal.errors.required",
    });
    expect(parseGoal("custom", {}, {}, "  ").errors).toEqual({
      description: "userPlans.goal.errors.descriptionRequired",
    });
  });

  it("fills required fields of a new goal type without overwriting typed ones", () => {
    expect(
      withRequiredGoalDefaults("improve_race_result", {
        distanceMeters: "21.1",
      }),
    ).toEqual({
      distanceMeters: "21.1",
      finishTimeSec: "50:00",
    });
  });
});
