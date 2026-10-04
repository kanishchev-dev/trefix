import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Stepper } from "./stepper";

export type RangeValue = {
  min: number;
  max: number;
};

export type RangeProps = {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  absoluteMin?: number;
  absoluteMax?: number;
  step?: number;
  unit?: string;
  formatValue?: (v: number) => string;
  theme?: ThemeTokens;
  themeMode?: ThemeMode;
  accessibilityLabel?: string;
  minLabel?: string;
  maxLabel?: string;
};

export function Range({
  value,
  onChange,
  absoluteMin = 0,
  absoluteMax = 100,
  step = 1,
  unit,
  formatValue,
  theme,
  themeMode,
  accessibilityLabel,
  minLabel = "Minimum",
  maxLabel = "Maximum",
}: RangeProps) {
  const isDark =
    themeMode === "dark" ||
    theme?.color.background === "#09090b" ||
    theme?.color.surface === "#111111";

  const handleMinChange = (newMin: number) => {
    const clampedMin = Math.max(absoluteMin, Math.min(newMin, value.max));
    onChange({ min: clampedMin, max: value.max });
  };

  const handleMaxChange = (newMax: number) => {
    const clampedMax = Math.min(absoluteMax, Math.max(newMax, value.min));
    onChange({ min: value.min, max: clampedMax });
  };

  const cardBg = isDark ? "#121214" : theme?.color.surface || "#ffffff";
  const borderCol = isDark ? "rgba(255, 255, 255, 0.08)" : theme?.color.border || "rgba(0, 0, 0, 0.08)";

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        {
          backgroundColor: cardBg,
          borderColor: borderCol,
        },
      ]}
    >
      <View style={styles.controlRow}>
        <Text
          style={[
            styles.label,
            {
              color: theme?.color.mutedForeground || (isDark ? "#a1a1aa" : "#71717a"),
              fontFamily: theme?.typography.fontFamily.sans.semibold || "System",
            },
          ]}
        >
          {minLabel}
        </Text>
        <Stepper
          value={value.min}
          onChange={handleMinChange}
          min={absoluteMin}
          max={value.max}
          step={step}
          formatValue={formatValue}
          unit={unit}
          theme={theme}
          themeMode={themeMode}
        />
      </View>

      <View style={styles.controlRow}>
        <Text
          style={[
            styles.label,
            {
              color: theme?.color.mutedForeground || (isDark ? "#a1a1aa" : "#71717a"),
              fontFamily: theme?.typography.fontFamily.sans.semibold || "System",
            },
          ]}
        >
          {maxLabel}
        </Text>
        <Stepper
          value={value.max}
          onChange={handleMaxChange}
          min={value.min}
          max={absoluteMax}
          step={step}
          formatValue={formatValue}
          unit={unit}
          theme={theme}
          themeMode={themeMode}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  controlRow: {
    width: "100%",
    gap: 6,
  },
  label: {
    fontSize: 13,
    marginLeft: 4,
  },
});
