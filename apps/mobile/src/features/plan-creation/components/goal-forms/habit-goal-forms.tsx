import { type ReactNode } from "react";
import { GOAL_FIELD_DEFAULTS as D } from "../../plan-creation-types";
import { type GoalFormKit } from "../use-goal-form-kit";

/** Goal forms of the "habit" group; `null` for goal types it does not cover. */
export function renderHabitGoalForm(
  goalType: string,
  kit: GoalFormKit,
): ReactNode {
  const {
    f,
    units,
    setter,
    read,
    plainRuler,
    minutesRuler,
    weeklyKmRuler,
    runsSegmented,
    field,
    optionalTarget,
    goalSection,
    currentSection,
    dateSection,
    screen,
  } = kit;
  switch (goalType) {
    case "build_consistency": {
      return screen(
        goalSection(
          field(
            f.runsPerWeek,
            runsSegmented(
              read("target", "runsPerWeek", D.runsPerWeek),
              setter("target", "runsPerWeek"),
            ),
          ),
        ),
        currentSection(
          { runsPerWeek: D.currentRunsPerWeek },
          field(
            f.runsPerWeek,
            runsSegmented(
              read("current", "runsPerWeek", D.currentRunsPerWeek),
              setter("current", "runsPerWeek"),
            ),
          ),
        ),
        dateSection,
      );
    }

    case "increase_running_volume": {
      return screen(
        goalSection(
          field(
            f.weeklyDistance,
            weeklyKmRuler(
              read("target", "weeklyDistanceKm", D.weeklyDistanceKm),
              setter("target", "weeklyDistanceKm"),
            ),
          ),
        ),
        currentSection(
          { weeklyDistanceKm: D.currentWeeklyDistanceKm },
          field(
            f.weeklyDistance,
            weeklyKmRuler(
              read("current", "weeklyDistanceKm", D.currentWeeklyDistanceKm),
              setter("current", "weeklyDistanceKm"),
            ),
          ),
        ),
        dateSection,
      );
    }

    case "lose_weight": {
      const weightRuler = (value: number, onChange: (v: number) => void) =>
        plainRuler(
          value,
          onChange,
          { min: 30, max: 250, step: 0.5, labelEvery: 5, unit: units.kg },
          f.weight,
        );
      return screen(
        goalSection(
          field(
            f.weight,
            weightRuler(
              read("target", "weightKg", D.targetWeightKg),
              setter("target", "weightKg"),
            ),
          ),
        ),
        currentSection(
          { weightKg: D.currentWeightKg },
          field(
            f.weight,
            weightRuler(
              read("current", "weightKg", D.currentWeightKg),
              setter("current", "weightKg"),
            ),
          ),
        ),
        dateSection,
      );
    }

    case "start_running": {
      return screen(
        goalSection(
          optionalTarget(
            "continuousDurationMinutes",
            D.startRunningTargetMinutes,
            f.continuous,
            f.addContinuous,
            (value, onChange) =>
              minutesRuler(value, onChange, 180, f.continuous),
          ),
        ),
        currentSection(
          { continuousDurationMinutes: D.startRunningCurrentMinutes },
          field(
            f.continuous,
            minutesRuler(
              read(
                "current",
                "continuousDurationMinutes",
                D.startRunningCurrentMinutes,
              ),
              setter("current", "continuousDurationMinutes"),
              180,
              f.continuous,
            ),
          ),
        ),
        dateSection,
      );
    }

    case "return_to_running": {
      return screen(
        goalSection(
          optionalTarget(
            "weeklyDistanceKm",
            D.weeklyDistanceKm,
            f.weeklyDistance,
            f.addWeeklyDistance,
            weeklyKmRuler,
          ),
        ),
        currentSection(
          { continuousDurationMinutes: D.currentContinuousMinutes },
          field(
            f.continuous,
            minutesRuler(
              read(
                "current",
                "continuousDurationMinutes",
                D.currentContinuousMinutes,
              ),
              setter("current", "continuousDurationMinutes"),
              1440,
              f.continuous,
            ),
          ),
        ),
        dateSection,
      );
    }

    case "maintain_fitness":
    case "general_health": {
      const isHealth = goalType === "general_health";
      return screen(
        goalSection(
          optionalTarget(
            "runsPerWeek",
            D.runsPerWeek,
            f.runsPerWeek,
            f.addRunsPerWeek,
            runsSegmented,
          ),
          isHealth
            ? optionalTarget(
                "weeklyDurationMinutes",
                D.weeklyDurationMinutes,
                f.weeklyDuration,
                f.addWeeklyDuration,
                (value, onChange) =>
                  plainRuler(
                    value,
                    onChange,
                    {
                      min: 20,
                      max: 1200,
                      step: 10,
                      majorEvery: 30,
                      labelEvery: 60,
                      unit: units.min,
                    },
                    f.weeklyDuration,
                  ),
              )
            : optionalTarget(
                "weeklyDistanceKm",
                D.weeklyDistanceKm,
                f.weeklyDistance,
                f.addWeeklyDistance,
                weeklyKmRuler,
              ),
        ),
        currentSection(
          { runsPerWeek: D.currentRunsPerWeek },
          field(
            f.runsPerWeek,
            runsSegmented(
              read("current", "runsPerWeek", D.currentRunsPerWeek),
              setter("current", "runsPerWeek"),
            ),
          ),
        ),
        dateSection,
      );
    }
    default:
      return null;
  }
}
