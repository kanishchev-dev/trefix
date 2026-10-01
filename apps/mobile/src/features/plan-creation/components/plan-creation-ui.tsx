import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { type ThemeTokens } from "@workspace/tokens";

import { PLAN_WEEKDAY_ORDER } from "../plan-creation-types";

type OptionChipProps = {
  label: string;
  selected: boolean;
  theme: ThemeTokens;
  onPress: () => void;
};

export function OptionChip({ label, selected, theme, onPress }: OptionChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.color.primary : theme.color.surfaceElevated,
          borderColor: selected ? theme.color.primary : theme.color.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          {
            color: selected ? theme.color.primaryForeground : theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type DayPickerProps = {
  selectedDays: number[];
  theme: ThemeTokens;
  shortDayNames: readonly string[];
  onToggleDay: (dayIndex: number) => void;
};

export function DayPicker({
  selectedDays,
  theme,
  shortDayNames,
  onToggleDay,
}: DayPickerProps) {
  return (
    <View style={styles.dayRow}>
      {PLAN_WEEKDAY_ORDER.map((dayIndex) => {
        const selected = selectedDays.includes(dayIndex);
        return (
          <Pressable
            key={dayIndex}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={shortDayNames[dayIndex]}
            onPress={() => onToggleDay(dayIndex)}
            style={({ pressed }) => [
              styles.dayCell,
              {
                backgroundColor: selected ? theme.color.primary : theme.color.surfaceElevated,
                borderColor: selected ? theme.color.primary : theme.color.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.dayLabel,
                {
                  color: selected ? theme.color.primaryForeground : theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {shortDayNames[dayIndex]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type CounterRowProps = {
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  theme: ThemeTokens;
  onChange: (value: number) => void;
};

export function CounterRow({ label, value, suffix, min, max, theme, onChange }: CounterRowProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View
      style={[
        styles.counterRow,
        {
          backgroundColor: theme.color.surfaceElevated,
          borderColor: theme.color.border,
        },
      ]}
    >
      <Text
        style={[
          styles.counterLabel,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
          },
        ]}
      >
        {label}
      </Text>

      <View style={styles.counterControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} minus`}
          disabled={!canDecrement}
          onPress={() => onChange(value - 1)}
          style={({ pressed }) => [
            styles.counterButton,
            { backgroundColor: theme.color.surface, opacity: canDecrement ? 1 : 0.35 },
            pressed && canDecrement && styles.pressed,
          ]}
        >
          <Minus color={theme.color.foreground} size={18} />
        </Pressable>

        <Text
          style={[
            styles.counterValue,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          {value}
          {suffix ? ` ${suffix}` : ""}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} plus`}
          disabled={!canIncrement}
          onPress={() => onChange(value + 1)}
          style={({ pressed }) => [
            styles.counterButton,
            { backgroundColor: theme.color.surface, opacity: canIncrement ? 1 : 0.35 },
            pressed && canIncrement && styles.pressed,
          ]}
        >
          <Plus color={theme.color.foreground} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

type SectionBlockProps = {
  title: string;
  theme: ThemeTokens;
  children: ReactNode;
};

export function SectionBlock({ title, theme, children }: SectionBlockProps) {
  return (
    <View style={styles.sectionBlock}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.bold,
          },
        ]}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

export function FieldError({ message, theme }: { message: string; theme: ThemeTokens }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.fieldError,
        { fontFamily: theme.typography.fontFamily.sans.regular },
      ]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  dayRow: {
    flexDirection: "row",
    gap: 8,
  },
  dayCell: {
    flex: 1,
    height: 44,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 13,
    lineHeight: 17,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  counterLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    minWidth: 56,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
  },
  fieldError: {
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 4,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
