import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DateWheel } from "@workspace/ui-native";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";
import { MANUAL_PLAN_MAX_WEEKS, MANUAL_PLAN_MIN_WEEKS } from "../plan-creation-types";

type TargetDatePickerProps = {
  /** "YYYY-MM-DD" or undefined when the goal has no date. */
  value?: string;
  onChange: (isoDate?: string) => void;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
  copy: MainCopy;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseLocalDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Goal target date: Day | Month | Year wheels with a caption
 * "weekday · in N wk" and a hint when the date falls outside the plan window.
 * Setting / removing the (optional) date is handled by the surrounding OptionalField.
 */
export function TargetDatePicker({ value, onChange, theme, themeMode, copy }: TargetDatePickerProps) {
  const pickerCopy = copy.plan.creation.datePicker;
  const today = useMemo(startOfToday, []);
  const todayIso = toIsoDate(today);

  const caption = useMemo(() => {
    if (!value) return null;
    const date = parseLocalDate(value);
    const daysAhead = Math.round((date.getTime() - today.getTime()) / DAY_MS);
    const weeks = Math.floor(daysAhead / 7);
    const days = daysAhead % 7;

    let relative: string;
    if (daysAhead <= 0) {
      relative = pickerCopy.today;
    } else if (daysAhead === 1) {
      relative = pickerCopy.tomorrow;
    } else {
      const parts = [
        weeks > 0 ? pickerCopy.weeksShort.replace("{{count}}", String(weeks)) : null,
        days > 0 ? pickerCopy.daysShort.replace("{{count}}", String(days)) : null,
      ].filter(Boolean);
      relative = pickerCopy.inTime.replace("{{value}}", parts.join(" "));
    }

    const outOfPlan =
      daysAhead < MANUAL_PLAN_MIN_WEEKS * 7 || daysAhead > MANUAL_PLAN_MAX_WEEKS * 7
        ? pickerCopy.outOfPlan
            .replace("{{min}}", String(MANUAL_PLAN_MIN_WEEKS))
            .replace("{{max}}", String(MANUAL_PLAN_MAX_WEEKS))
        : null;

    return { main: `${pickerCopy.weekdays[date.getDay()]} · ${relative}`, outOfPlan };
  }, [value, today, pickerCopy]);

  const regular = theme.typography.fontFamily.sans.regular;
  const medium = theme.typography.fontFamily.sans.medium;
  const semibold = theme.typography.fontFamily.sans.semibold;

  if (!value) return null;

  return (
    <View style={styles.container}>
      {caption ? (
        <Text style={[styles.caption, { color: theme.color.mutedForeground, fontFamily: regular }]}>
          {caption.main}
          {caption.outOfPlan ? (
            <Text style={{ color: theme.color.foreground, fontFamily: medium }}>
              {` · ${caption.outOfPlan}`}
            </Text>
          ) : null}
        </Text>
      ) : null}

      <DateWheel
        value={value}
        onChange={onChange}
        minDate={todayIso}
        monthNames={pickerCopy.months}
        theme={theme}
        themeMode={themeMode}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 20,
  },
  actionText: {
    fontSize: 15,
    lineHeight: 20,
  },
  clearButton: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
});
