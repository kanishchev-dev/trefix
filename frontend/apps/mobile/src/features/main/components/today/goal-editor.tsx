import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Clock3 } from "lucide-react-native";

import { type WorkoutGoal } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Ruler } from "@trefix/ui-native";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../../locales";
import { displayToKm } from "../../../../shared/lib/units";
import { SheetBlock, SheetTabs } from "../../../../shared/ui/bottom-sheet";
import { SheetList, SheetListRow } from "../../../../shared/ui/sheet-list";
import { useCurrentMetrics } from "../../../plans/hooks/use-plan-rebuild";
import { useUnitFormat } from "../../../profile/hooks/use-unit-format";
import { formatPaceValue } from "../../../tracker/format";
import { estimatedPaceSec, goalPace } from "../../lib/goal-estimate";

const DISTANCE_PRESETS = {
  metric: [3, 5, 8, 10, 15],
  imperial: [2, 3, 5, 6, 10],
};
const DURATION_PRESETS = [20, 30, 45, 60, 90];

export type GoalDraft = {
  goal: WorkoutGoal;
  /** Duration goal, minutes. */
  minutes: number;
  /** Distance goal in the user's units (km or mi). */
  distance: number;
  /** Distance goal: finish within, minutes. */
  timeLimitMin: number | null;
};

export function defaultGoalDraft(units: "metric" | "imperial"): GoalDraft {
  return {
    goal: "duration",
    minutes: 45,
    distance: units === "imperial" ? 3 : 5,
    timeLimitMin: null,
  };
}

type Props = {
  draft: GoalDraft;
  onChange: (draft: GoalDraft) => void;
  /** Shows the "Finish within" row of a distance goal. */
  onEditTimeLimit?: () => void;
  workoutType: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/**
 * The goal part of the goal sheets (Today and the tracker setup): no goal,
 * time or distance on a ruler with presets, and an estimate of the other value
 * that is only shown, never stored.
 */
export function GoalEditor({
  draft,
  onChange,
  onEditTimeLimit,
  workoutType,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const s = copy.today.goalSheet;
  const format = useUnitFormat(copy, language);
  const units = format.units;
  const distanceUnit =
    units === "imperial" ? format.labels.mi : format.labels.km;
  const paceUnit =
    units === "imperial" ? format.labels.perMi : format.labels.perKm;
  const metrics = useCurrentMetrics();
  const thresholdPace = metrics.data?.thresholdPaceSecondsPerKm.value ?? null;
  const { goal, minutes, distance, timeLimitMin } = draft;
  const setGoal = (next: WorkoutGoal) => onChange({ ...draft, goal: next });
  const setMinutes = (next: number) => onChange({ ...draft, minutes: next });
  const setDistance = (next: number) => onChange({ ...draft, distance: next });

  const estimate = useMemo(
    () =>
      goalEstimateText(draft, workoutType, thresholdPace, {
        copy,
        format,
        paceUnit,
      }),
    [copy, draft, format, paceUnit, thresholdPace, workoutType],
  );

  const muted = theme.color.mutedForeground;
  const iconProps = {
    size: 20,
    color: theme.color.foreground,
    strokeWidth: 1.9,
  };
  const presets =
    goal === "distance" ? DISTANCE_PRESETS[units] : DURATION_PRESETS;
  const presetValue = goal === "distance" ? distance : minutes;

  return (
    <>
      <SheetBlock theme={theme}>
        <SheetTabs
          value={goal}
          onChange={setGoal}
          trackColor={theme.color.screen}
          theme={theme}
          tabs={(["none", "duration", "distance"] as const).map((key) => ({
            key,
            label: s.tabs[key],
          }))}
        />
      </SheetBlock>

      {goal !== "none" ? (
        <SheetBlock theme={theme}>
          <Ruler
            value={goal === "distance" ? distance : minutes}
            onChange={(value) =>
              goal === "distance" ? setDistance(value) : setMinutes(value)
            }
            min={goal === "distance" ? 0.5 : 5}
            max={goal === "distance" ? 100 : 600}
            step={goal === "distance" ? 0.1 : 1}
            majorEvery={goal === "distance" ? 1 : 5}
            labelEvery={goal === "distance" ? 1 : 5}
            unit={goal === "distance" ? distanceUnit : s.durationUnit}
            accessibilityLabel={s.tabs[goal]}
            theme={theme}
            themeMode={themeMode}
          />
        </SheetBlock>
      ) : null}

      {goal === "distance" && onEditTimeLimit ? (
        <SheetBlock theme={theme}>
          <SheetList theme={theme}>
            <SheetListRow
              theme={theme}
              icon={<Clock3 {...iconProps} />}
              title={s.timeLimit}
              value={timeLimitMin ? format.minutes(timeLimitMin) : s.notSet}
              valueStrong={Boolean(timeLimitMin)}
              chevron
              onPress={onEditTimeLimit}
            />
          </SheetList>
        </SheetBlock>
      ) : null}

      <SheetBlock theme={theme}>
        <Text
          numberOfLines={1}
          style={[
            styles.estimate,
            {
              color: muted,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {estimate}
        </Text>
      </SheetBlock>

      {goal !== "none" ? (
        <SheetBlock theme={theme} edgeToEdge>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pills}
          >
            {presets.map((preset) => {
              const selected = Math.abs(presetValue - preset) < 1e-6;
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    goal === "distance"
                      ? setDistance(preset)
                      : setMinutes(preset)
                  }
                  style={({ pressed }) => [
                    styles.pill,
                    {
                      backgroundColor: selected
                        ? theme.color.primary
                        : theme.color.iconSurface,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: selected
                          ? theme.color.primaryForeground
                          : theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.medium,
                      },
                    ]}
                  >
                    {`${preset} ${goal === "distance" ? distanceUnit : s.durationUnit}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </SheetBlock>
      ) : null}
    </>
  );
}

/** "≈ 8.3 km at 6:00 /km", the corridor of a time limit, or the no-goal hint. */
export function goalEstimateText(
  draft: GoalDraft,
  workoutType: string,
  thresholdPace: number | null,
  {
    copy,
    format,
    paceUnit,
  }: {
    copy: MainCopy;
    format: ReturnType<typeof useUnitFormat>;
    paceUnit: string;
  },
): string {
  const s = copy.today.goalSheet;
  const units = format.units;
  const pace = estimatedPaceSec(workoutType, thresholdPace);
  const paceText = `${formatPaceValue(pace, units)} ${paceUnit}`;
  const distanceKm = displayToKm(draft.distance, units);
  if (draft.goal === "duration") {
    return fillTemplate(s.estimateDistance, {
      distance: format.distance((draft.minutes * 60) / pace),
      pace: paceText,
    });
  }
  if (draft.goal === "distance") {
    const corridor = draft.timeLimitMin
      ? goalPace(distanceKm, draft.timeLimitMin)
      : null;
    if (corridor) {
      return fillTemplate(s.corridor, {
        pace: `${formatPaceValue(corridor.pace, units)} ${paceUnit}`,
        min: formatPaceValue(corridor.min, units),
        max: formatPaceValue(corridor.max, units),
      });
    }
    return fillTemplate(s.estimateDuration, {
      duration: format.minutes(Math.round((distanceKm * pace) / 60)),
      pace: paceText,
    });
  }
  return s.noGoalHint;
}

const styles = StyleSheet.create({
  estimate: {
    marginTop: -4,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  pills: { gap: 8, paddingHorizontal: 20 },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 14, lineHeight: 18 },
  pressed: { opacity: 0.82 },
});
