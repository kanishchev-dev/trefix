import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";

import { SheetBlock } from "../../../shared/ui/bottom-sheet";
import { parseTargetTime, PLAN_WEEKDAY_ORDER } from "../plan-creation-types";
import { Compound, Segmented, type SegmentItem, Stepper, Wheel } from "@workspace/ui-native";

type OptionChipProps = {
  label: string;
  selected: boolean;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
  onPress: () => void;
};

export function OptionChip({ label, selected, theme, themeMode, onPress }: OptionChipProps) {
  const isDark = themeMode === "dark" || theme.color.background === "#09090b";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? theme.color.primary
            : isDark
              ? "#1a1a1e"
              : theme.color.surface,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.08)"
            : theme.color.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          {
            color: selected
              ? theme.color.primaryForeground
              : theme.color.foreground,
            fontFamily: selected
              ? theme.typography.fontFamily.sans.bold
              : theme.typography.fontFamily.sans.medium,
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
  themeMode?: ThemeMode;
  shortDayNames: readonly string[];
  onToggleDay: (dayIndex: number) => void;
};

export function DayPicker({
  selectedDays,
  theme,
  themeMode,
  shortDayNames,
  onToggleDay,
}: DayPickerProps) {
  const isDark = themeMode === "dark" || theme.color.background === "#09090b";

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
                backgroundColor: selected
                  ? theme.color.primary
                  : isDark
                    ? "#121214"
                    : theme.color.surfaceElevated,
                borderColor: selected
                  ? theme.color.primary
                  : isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : theme.color.border,
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
  themeMode?: ThemeMode;
  onChange: (value: number) => void;
};

export function CounterRow({
  label,
  value,
  suffix,
  min,
  max,
  theme,
  themeMode,
  onChange,
}: CounterRowProps) {
  const isDark = themeMode === "dark" || theme.color.background === "#09090b";

  return (
    <View
      style={[
        styles.counterRow,
        {
          backgroundColor: isDark ? "#121214" : theme.color.surfaceElevated,
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
          gap: 12,
        },
      ]}
    >
      <Text
        style={[
          styles.counterLabel,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
            flex: 1,
          },
        ]}
      >
        {label}
      </Text>

      <View style={{ width: 150 }}>
        <Stepper
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={1}
          unit={suffix}
          theme={theme}
          themeMode={themeMode}
        />
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
    <SheetBlock theme={theme}>
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
    </SheetBlock>
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

export { CalendarDatePicker } from "./calendar-date-picker";

/**
 * Universal Race Distance Selector using Segmented
 */
type RaceDistanceSelectorProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
  onChange: (value: T) => void;
};

export function RaceDistanceSelector<T extends string>({
  options,
  value,
  theme,
  themeMode,
  onChange,
}: RaceDistanceSelectorProps<T>) {
  const segments = options.map((opt) => ({
    label: opt.label,
    value: opt.value,
  }));

  return (
    <Segmented
      segments={segments}
      value={value}
      onChange={onChange}
      theme={theme}
      themeMode={themeMode}
    />
  );
}

/**
 * Universal Wheel Input Row for numeric metrics (distance, volume, weight, elevation, etc.)
 */
type WheelInputRowProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (v: number) => string;
  badge?: string;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
};

export function WheelInputRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  formatValue,
  badge,
  theme,
  themeMode,
}: WheelInputRowProps) {
  const isDark = themeMode === "dark" || theme.color.background === "#09090b";
  const displayVal = formatValue
    ? formatValue(value)
    : unit
      ? `${value} ${unit}`
      : String(value);

  return (
    <View style={styles.inputRowBlock}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>

        <View style={styles.badgeGroup}>
          <View
            style={[
              styles.valueBadgePill,
              { backgroundColor: isDark ? "#27272a" : theme.color.secondary },
            ]}
          >
            <Text
              style={[
                styles.valueBadgeText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {displayVal}
            </Text>
          </View>

          {badge ? (
            <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
              <Text
                style={[
                  styles.badgePillText,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.wheelCardWrapper,
          {
            backgroundColor: isDark ? "#121214" : theme.color.surfaceElevated,
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
          },
        ]}
      >
        <Wheel
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          formatValue={formatValue}
          theme={theme}
          themeMode={themeMode}
          visibleItems={3}
          itemHeight={40}
        />
      </View>
    </View>
  );
}

/**
 * Universal Segmented Row for Direct Selection (e.g. 1-7 options)
 */
export function SegmentedRow<T>({
  label,
  segments,
  value,
  onChange,
  badge,
  theme,
  themeMode,
}: {
  label: string;
  segments: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  badge?: string;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
}) {
  return (
    <View style={styles.inputRowBlock}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
            <Text
              style={[
                styles.badgePillText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Segmented
        segments={segments}
        value={value}
        onChange={onChange}
        theme={theme}
        themeMode={themeMode}
      />
    </View>
  );
}

/**
 * Universal Compound Time Input Row for Finish Times (e.g. 00:45:00 or 45:00)
 */
export function CompoundTimerInputRow({
  label,
  value,
  onChangeText,
  badge,
  error,
  theme,
  themeMode,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  badge?: string;
  error?: string | null;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
}) {
  const seconds = parseTargetTime(value) ?? 2700; // default 45 min
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [
    {
      label: "часы",
      value: hours,
      min: 0,
      max: 12,
      formatValue: (v: number) => String(v).padStart(2, "0"),
    },
    {
      label: "мин",
      value: minutes,
      min: 0,
      max: 59,
      formatValue: (v: number) => String(v).padStart(2, "0"),
    },
    {
      label: "сек",
      value: secs,
      min: 0,
      max: 59,
      step: 5,
      formatValue: (v: number) => String(v).padStart(2, "0"),
    },
  ];

  const handlePartChange = (partIndex: number, newVal: number) => {
    let newH = hours;
    let newM = minutes;
    let newS = secs;

    if (partIndex === 0) newH = newVal;
    if (partIndex === 1) newM = newVal;
    if (partIndex === 2) newS = newVal;

    const p = (v: number) => String(v).padStart(2, "0");
    const formatted = newH > 0 ? `${newH}:${p(newM)}:${p(newS)}` : `${newM}:${p(newS)}`;
    onChangeText(formatted);
  };

  return (
    <View style={styles.inputRowBlock}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
            <Text
              style={[
                styles.badgePillText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Compound
        parts={parts}
        onChangePart={handlePartChange}
        theme={theme}
        themeMode={themeMode}
      />

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

/**
 * Universal Compound Pace Input Row (e.g. 05:30 /km)
 */
export function CompoundPaceInputRow({
  label,
  value,
  onChangeText,
  badge,
  error,
  theme,
  themeMode,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  badge?: string;
  error?: string | null;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
}) {
  const parsed = parseTargetTime(value) ?? 330; // default 5:30
  const minutes = Math.floor(parsed / 60);
  const secs = parsed % 60;

  const parts = [
    {
      label: "мин",
      value: minutes,
      min: 2,
      max: 15,
      formatValue: (v: number) => String(v).padStart(2, "0"),
    },
    {
      label: "сек",
      value: secs,
      min: 0,
      max: 59,
      step: 5,
      formatValue: (v: number) => String(v).padStart(2, "0"),
    },
  ];

  const handlePartChange = (partIndex: number, newVal: number) => {
    let newM = minutes;
    let newS = secs;

    if (partIndex === 0) newM = newVal;
    if (partIndex === 1) newS = newVal;

    const p = (v: number) => String(v).padStart(2, "0");
    const formatted = `${newM}:${p(newS)}`;
    onChangeText(formatted);
  };

  return (
    <View style={styles.inputRowBlock}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
            <Text
              style={[
                styles.badgePillText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Compound
        parts={parts}
        onChangePart={handlePartChange}
        unit="/км"
        theme={theme}
        themeMode={themeMode}
      />

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

type FormInputRowProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  unit?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation';
  error?: string | null;
  badge?: string;
  theme: ThemeTokens;
};

export function FormInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  keyboardType = 'numeric',
  error,
  badge,
  theme,
}: FormInputRowProps) {
  return (
    <View style={styles.inputRowBlock}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
            <Text
              style={[
                styles.badgePillText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          accessibilityLabel={label}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={theme.color.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.textInput,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: error ? '#dc2626' : theme.color.border,
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        />
        {unit ? (
          <Text
            style={[
              styles.unitSuffix,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

type MultilineInputRowProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  badge?: string;
  theme: ThemeTokens;
};

export function MultilineInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  badge,
  theme,
}: MultilineInputRowProps) {
  return (
    <View style={styles.inputRowBlock}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
            <Text
              style={[
                styles.badgePillText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <TextInput
        accessibilityLabel={label}
        multiline
        numberOfLines={4}
        placeholder={placeholder}
        placeholderTextColor={theme.color.mutedForeground}
        textAlignVertical="top"
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.multilineInput,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: error ? '#dc2626' : theme.color.border,
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      />

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRowBlock: {
    gap: 8,
  },
  inputRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputRowLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  valueBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  valueBadgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    lineHeight: 14,
  },
  inputContainer: {
    position: "relative",
    justifyContent: "center",
  },
  textInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  unitSuffix: {
    position: "absolute",
    right: 16,
    fontSize: 13,
  },
  multilineInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 96,
  },
  wheelCardWrapper: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  counterLabel: {
    fontSize: 15,
    lineHeight: 20,
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
