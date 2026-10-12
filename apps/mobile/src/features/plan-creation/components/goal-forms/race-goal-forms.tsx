import { type ReactNode } from "react";
import { View } from "react-native";
import { Ruler } from "@trefix/ui-native";
import {
  GOAL_FIELD_DEFAULTS as D,
  RACE_DISTANCE_PRESETS_METERS,
  fitTimeToRange,
  raceTimeRange,
} from "../../plan-creation-types";
import { OptionChip, TimeRuler } from "../plan-creation-ui";
import { styles } from "../goal-setup-step.styles";
import { asNumber } from "../goal-setup-helpers";
import { type GoalFormKit } from "../use-goal-form-kit";

/** Goal forms of the "race" group; `null` for goal types it does not cover. */
export function renderRaceGoalForm(
  goalType: string,
  kit: GoalFormKit,
): ReactNode {
  const {
    f,
    units,
    durationLabel,
    target,
    current,
    update,
    setter,
    read,
    kmRuler,
    plainRuler,
    weeklyKmRuler,
    field,
    optionalTarget,
    goalSection,
    currentSection,
    dateSection,
    screen,
    theme,
  } = kit;
  switch (goalType) {
    case "prepare_for_race":
    case "improve_race_result":
    case "run_new_distance": {
      const distanceMeters = read("target", "distanceMeters", 10_000);
      const range = raceTimeRange(distanceMeters);
      const timeRuler =
        (label: string) => (value: number, onChange: (v: number) => void) => (
          <TimeRuler
            seconds={value}
            onChange={onChange}
            range={range}
            accessibilityLabel={label}
            theme={theme}
          />
        );

      /** New distance: keep entered times if they still fit the new scale, else use its defaults. */
      const setDistance = (meters: number) => {
        const nextRange = raceTimeRange(meters);
        const targetTime = asNumber(target.finishTimeSec);
        update("target", {
          distanceMeters: meters,
          finishTimeSec:
            targetTime === undefined
              ? undefined
              : fitTimeToRange(targetTime, nextRange, nextRange.defaultTarget),
        });
        const currentTime = asNumber(current.finishTimeSec);
        if (currentTime !== undefined) {
          update("current", {
            finishTimeSec: fitTimeToRange(
              currentTime,
              nextRange,
              nextRange.defaultCurrent,
            ),
          });
        }
      };

      const distanceField = field(
        f.raceDistance,
        <View style={styles.fields}>
          {/* 0.1 km steps so 21.1 / 42.2 are reachable; up to 300 km (backend bound). */}
          <Ruler
            value={distanceMeters / 1000}
            onChange={(km) => setDistance(Math.round(km * 1000))}
            min={1}
            max={300}
            step={0.1}
            majorEvery={1}
            labelEvery={1}
            tickSpacing={10}
            unit={units.km}
            accessibilityLabel={f.raceDistance}
            theme={theme}
          />
          <View style={styles.chipWrap}>
            {RACE_DISTANCE_PRESETS_METERS.map((meters) => (
              <OptionChip
                key={meters}
                label={`${Number((meters / 1000).toFixed(1))} ${units.km}`}
                selected={Math.abs(distanceMeters - meters) < 50}
                theme={theme}
                onPress={() => setDistance(meters)}
              />
            ))}
          </View>
        </View>,
        f.raceDistanceInfo,
      );

      const timeField =
        goalType === "improve_race_result"
          ? field(
              f.finishTime,
              timeRuler(f.finishTime)(
                read("target", "finishTimeSec", range.defaultTarget),
                setter("target", "finishTimeSec"),
              ),
            )
          : goalType === "prepare_for_race"
            ? optionalTarget(
                "finishTimeSec",
                range.defaultTarget,
                f.finishTime,
                f.addFinishTime,
                timeRuler(f.finishTime),
                f.finishTimeInfo,
              )
            : null;

      const currentBlock =
        goalType === "run_new_distance"
          ? currentSection(
              { distanceMeters: D.longestRunMeters },
              field(
                f.longestRun,
                kmRuler(
                  read("current", "distanceMeters", D.longestRunMeters),
                  setter("current", "distanceMeters"),
                  { min: 1, max: 100, step: 0.5 },
                  f.longestRun,
                ),
                f.longestRunInfo,
              ),
            )
          : currentSection(
              { finishTimeSec: range.defaultCurrent },
              field(
                f.bestTime,
                timeRuler(f.bestTime)(
                  read("current", "finishTimeSec", range.defaultCurrent),
                  setter("current", "finishTimeSec"),
                ),
                f.bestTimeInfo,
              ),
            );

      return screen(
        goalSection(distanceField, timeField),
        currentBlock,
        dateSection,
      );
    }

    case "trail_preparation":
    case "ultra_preparation": {
      const isUltra = goalType === "ultra_preparation";
      return screen(
        goalSection(
          field(
            f.distance,
            kmRuler(
              read(
                "target",
                "distanceMeters",
                isUltra ? D.ultraDistanceMeters : D.trailDistanceMeters,
              ),
              setter("target", "distanceMeters"),
              { min: 5, max: 300 },
              f.distance,
            ),
            f.trailDistanceInfo,
          ),
          optionalTarget(
            "elevationGainMeters",
            isUltra ? D.ultraElevationMeters : D.trailElevationMeters,
            f.elevation,
            f.addElevation,
            (value, onChange) =>
              plainRuler(
                value,
                onChange,
                { min: 0, max: 10_000, step: 100, unit: units.m },
                f.elevation,
              ),
            f.trailElevationInfo,
          ),
        ),
        currentSection(
          {
            distanceMeters: D.longestRunMeters,
            weeklyDistanceKm: D.currentWeeklyDistanceKm,
          },
          field(
            f.longestRun,
            kmRuler(
              read("current", "distanceMeters", D.longestRunMeters),
              setter("current", "distanceMeters"),
              { min: 1, max: 300, step: 0.5 },
              f.longestRun,
            ),
            f.longestRunInfo,
          ),
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

    case "backyard_preparation": {
      return screen(
        goalSection(
          field(
            f.loops,
            plainRuler(
              read("target", "loopsCount", D.loopsCount),
              setter("target", "loopsCount"),
              { min: 1, max: 100, majorEvery: 5, labelEvery: 5 },
              f.loops,
            ),
            f.loopsInfo,
          ),
        ),
        currentSection(
          { timeOnFeetMinutes: D.timeOnFeetMinutes },
          field(
            f.timeOnFeet,
            plainRuler(
              read("current", "timeOnFeetMinutes", D.timeOnFeetMinutes),
              setter("current", "timeOnFeetMinutes"),
              {
                min: 30,
                max: 4320,
                step: 30,
                majorEvery: 60,
                labelEvery: 240,
                formatValue: durationLabel,
                formatLabel: (minutes) => `${minutes / 60} ${units.h}`,
              },
              f.timeOnFeet,
            ),
            f.timeOnFeetInfo,
          ),
        ),
        dateSection,
      );
    }
    default:
      return null;
  }
}
