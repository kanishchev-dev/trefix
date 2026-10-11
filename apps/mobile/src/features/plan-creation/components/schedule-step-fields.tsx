import { StyleSheet, Text } from "react-native";

import { type ManualPlanScheduleInput } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Ruler } from "@workspace/ui-native";

import { fillTemplate, type MainCopy } from "../../../locales";
import {
  MANUAL_PLAN_MAX_DURATION_MINUTES,
  MANUAL_PLAN_MIN_DURATION_MINUTES,
} from "../plan-creation-types";
import { DayPicker, SectionBlock } from "./plan-creation-ui";

type Props = {
  schedule: ManualPlanScheduleInput;
  /** Toggles a training day; the owner keeps dependent values (long run day, sessions) consistent. */
  onToggleDay: (dayIndex: number) => void;
  onChange: (
    updater: (current: ManualPlanScheduleInput) => ManualPlanScheduleInput,
  ) => void;
  shortDayNames: readonly string[];
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/** "Your schedule" fields: training days, long run day and usual workout length. */
export function ScheduleStepFields({
  schedule,
  onToggleDay,
  onChange,
  shortDayNames,
  theme,
  themeMode,
  copy,
}: Props) {
  const creationCopy = copy.plan.creation;

  return (
    <>
      <SectionBlock
        title={creationCopy.trainingDaysSection}
        description={creationCopy.trainingDaysHint}
        theme={theme}
      >
        <DayPicker
          selectedDays={schedule.trainingDays}
          theme={theme}
          themeMode={themeMode}
          shortDayNames={shortDayNames}
          onToggleDay={onToggleDay}
        />
        <Text
          style={[
            styles.dayCountText,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {fillTemplate(creationCopy.sessionsPerWeekText, {
            count: schedule.trainingDays.length,
          })}
        </Text>
      </SectionBlock>

      <SectionBlock
        title={creationCopy.longRunSection}
        description={creationCopy.longRunHint}
        theme={theme}
      >
        {/* Same week row as training days; only training days can be picked. Tap again to clear. */}
        <DayPicker
          selectedDays={
            schedule.preferredLongRunDay !== undefined
              ? [schedule.preferredLongRunDay]
              : []
          }
          disabledDays={[0, 1, 2, 3, 4, 5, 6].filter(
            (day) => !schedule.trainingDays.includes(day),
          )}
          theme={theme}
          themeMode={themeMode}
          shortDayNames={shortDayNames}
          onToggleDay={(dayIndex) =>
            onChange((current) => ({
              ...current,
              preferredLongRunDay:
                current.preferredLongRunDay === dayIndex ? undefined : dayIndex,
            }))
          }
        />
      </SectionBlock>

      <SectionBlock
        title={creationCopy.durationSection}
        description={creationCopy.durationHint}
        theme={theme}
      >
        <Ruler
          value={schedule.workoutDurationMinutes ?? 45}
          onChange={(minutes) =>
            onChange((current) => ({
              ...current,
              workoutDurationMinutes: minutes,
            }))
          }
          min={MANUAL_PLAN_MIN_DURATION_MINUTES}
          max={MANUAL_PLAN_MAX_DURATION_MINUTES}
          step={5}
          majorEvery={15}
          labelEvery={30}
          unit={creationCopy.units.min}
          accessibilityLabel={creationCopy.durationSection}
          theme={theme}
          themeMode={themeMode}
        />
      </SectionBlock>
    </>
  );
}

/** Toggles a day and drops the long run day when it is no longer a training day. */
export function toggleTrainingDay(
  schedule: ManualPlanScheduleInput,
  dayIndex: number,
): ManualPlanScheduleInput {
  const selected = schedule.trainingDays.includes(dayIndex);
  const trainingDays = selected
    ? schedule.trainingDays.filter((day) => day !== dayIndex)
    : [...schedule.trainingDays, dayIndex].sort((a, b) => a - b);
  const preferredLongRunDay =
    schedule.preferredLongRunDay !== undefined &&
    trainingDays.includes(schedule.preferredLongRunDay)
      ? schedule.preferredLongRunDay
      : undefined;
  return { ...schedule, trainingDays, preferredLongRunDay };
}

const styles = StyleSheet.create({
  dayCountText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
