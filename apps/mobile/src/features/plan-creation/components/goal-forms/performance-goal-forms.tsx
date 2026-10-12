import { type ReactNode } from "react";
import { Text, View } from "react-native";
import { Segmented } from "@trefix/ui-native";
import { GOAL_FIELD_DEFAULTS as D } from "../../plan-creation-types";
import { PACE_RANGE, TimeRuler } from "../plan-creation-ui";
import { styles } from "../goal-setup-step.styles";
import { asNumber } from "../goal-setup-helpers";
import { type GoalFormKit } from "../use-goal-form-kit";

/** Goal forms of the "performance" group; `null` for goal types it does not cover. */
export function renderPerformanceGoalForm(
  goalType: string,
  kit: GoalFormKit,
): ReactNode {
  const {
    f,
    units,
    paceUnit,
    target,
    current,
    update,
    setter,
    read,
    kmRuler,
    plainRuler,
    minutesRuler,
    field,
    optionalTarget,
    goalSection,
    currentSection,
    dateSection,
    screen,
    theme,
  } = kit;
  switch (goalType) {
    case "improve_speed":
    case "improve_pace": {
      const paceRuler = (value: number, onChange: (v: number) => void) => (
        <TimeRuler
          seconds={value}
          onChange={onChange}
          range={PACE_RANGE}
          unit={paceUnit}
          accessibilityLabel={f.pace}
          theme={theme}
        />
      );
      return screen(
        goalSection(
          field(
            f.pace,
            paceRuler(
              read("target", "paceSecondsPerKm", D.targetPace),
              setter("target", "paceSecondsPerKm"),
            ),
          ),
          goalType === "improve_pace"
            ? optionalTarget(
                "distanceMeters",
                D.paceDistanceMeters,
                f.paceDistance,
                f.addPaceDistance,
                (value, onChange) =>
                  kmRuler(value, onChange, { min: 1, max: 50 }, f.paceDistance),
                f.paceDistanceInfo,
              )
            : null,
        ),
        currentSection(
          { paceSecondsPerKm: D.currentPace },
          field(
            f.pace,
            paceRuler(
              read("current", "paceSecondsPerKm", D.currentPace),
              setter("current", "paceSecondsPerKm"),
            ),
          ),
        ),
        dateSection,
      );
    }

    case "build_endurance":
    case "run_continuously": {
      const isEndurance = goalType === "build_endurance";
      const byDistance = asNumber(target.continuousDistanceKm) !== undefined;
      const switchMeasure = (toDistance: boolean) => {
        if (toDistance === byDistance) return;
        update("target", {
          continuousDistanceKm: toDistance
            ? isEndurance
              ? D.enduranceDistanceKm
              : D.continuousDistanceKm
            : undefined,
          continuousDurationMinutes: toDistance
            ? undefined
            : isEndurance
              ? D.enduranceMinutes
              : D.continuousMinutes,
        });
        // Keep the current level in the same measure as the goal.
        if (Object.keys(current).length > 0) {
          update("current", {
            continuousDistanceKm: toDistance
              ? D.currentContinuousDistanceKm
              : undefined,
            continuousDurationMinutes: toDistance
              ? undefined
              : D.currentContinuousMinutes,
          });
        }
      };
      const distanceRuler = (value: number, onChange: (v: number) => void) =>
        plainRuler(
          value,
          onChange,
          { min: 0.5, max: 300, step: 0.5, unit: units.km },
          f.continuous,
        );

      return screen(
        goalSection(
          field(
            f.continuous,
            <View style={styles.fields}>
              <Segmented
                segments={[
                  { label: f.measureTime, value: "time" },
                  { label: f.measureDistance, value: "distance" },
                ]}
                value={byDistance ? "distance" : "time"}
                onChange={(measure) => switchMeasure(measure === "distance")}
                theme={theme}
              />
              {byDistance
                ? distanceRuler(
                    read(
                      "target",
                      "continuousDistanceKm",
                      D.continuousDistanceKm,
                    ),
                    setter("target", "continuousDistanceKm"),
                  )
                : minutesRuler(
                    read(
                      "target",
                      "continuousDurationMinutes",
                      D.continuousMinutes,
                    ),
                    setter("target", "continuousDurationMinutes"),
                    1440,
                    f.continuous,
                  )}
            </View>,
            f.continuousInfo,
          ),
        ),
        byDistance
          ? currentSection(
              { continuousDistanceKm: D.currentContinuousDistanceKm },
              field(
                f.continuous,
                distanceRuler(
                  read(
                    "current",
                    "continuousDistanceKm",
                    D.currentContinuousDistanceKm,
                  ),
                  setter("current", "continuousDistanceKm"),
                ),
              ),
            )
          : currentSection(
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

    case "improve_hills": {
      const elevationRuler = (value: number, onChange: (v: number) => void) =>
        plainRuler(
          value,
          onChange,
          {
            min: 0,
            max: 3000,
            step: 50,
            majorEvery: 250,
            labelEvery: 500,
            unit: units.m,
          },
          f.elevation,
        );
      return screen(
        goalSection(
          optionalTarget(
            "elevationGainMeters",
            D.hillsElevationMeters,
            f.elevation,
            f.addElevation,
            elevationRuler,
            f.hillsElevationInfo,
          ),
        ),
        currentSection(
          { elevationGainMeters: D.hillsElevationMeters / 2 },
          field(
            f.elevation,
            elevationRuler(
              read(
                "current",
                "elevationGainMeters",
                D.hillsElevationMeters / 2,
              ),
              setter("current", "elevationGainMeters"),
            ),
            f.hillsElevationInfo,
          ),
        ),
        dateSection,
      );
    }

    case "improve_aerobic_fitness": {
      return screen(
        goalSection(
          <Text
            key="note"
            style={[
              styles.note,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {f.aerobicNote}
          </Text>,
        ),
        dateSection,
      );
    }
    default:
      return null;
  }
}
