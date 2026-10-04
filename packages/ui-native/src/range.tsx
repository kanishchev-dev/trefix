import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { type ThemeTokens } from "@workspace/tokens";
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
  accessibilityLabel,
  minLabel = "Minimum",
  maxLabel = "Maximum",
}: RangeProps) {
  const handleMinChange = (newMin: number) => {
    const clampedMin = Math.max(absoluteMin, Math.min(newMin, value.max));
    onChange({ min: clampedMin, max: value.max });
  };

  const handleMaxChange = (newMax: number) => {
    const clampedMax = Math.min(absoluteMax, Math.max(newMax, value.min));
    onChange({ min: value.min, max: clampedMax });
  };

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
    >
      <View style={styles.controlRow}>
        <Text
          style={[
            styles.label,
            { color: theme?.color.mutedForeground || "#71717a" },
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
        />
      </View>

      <View style={styles.controlRow}>
        <Text
          style={[
            styles.label,
            { color: theme?.color.mutedForeground || "#71717a" },
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
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 16,
  },
  controlRow: {
    width: "100%",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 4,
  },
});
