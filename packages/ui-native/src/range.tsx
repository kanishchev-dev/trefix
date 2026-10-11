import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { resolveTheme } from "./theme";
import { Ruler } from "./ruler";

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
  const t = resolveTheme(theme, themeMode);

  const handleMinChange = (newMin: number) => {
    const clampedMin = Math.max(absoluteMin, Math.min(newMin, value.max));
    onChange({ min: clampedMin, max: value.max });
  };

  const handleMaxChange = (newMax: number) => {
    const clampedMax = Math.min(absoluteMax, Math.max(newMax, value.min));
    onChange({ min: value.min, max: clampedMax });
  };

  const cardBg = t.color.sheet;
  const borderCol = t.color.controlBorder;

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
              color: t.color.mutedForeground,
              fontFamily:
                theme?.typography.fontFamily.sans.semibold || "System",
            },
          ]}
        >
          {minLabel}
        </Text>
        <Ruler
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
              color: t.color.mutedForeground,
              fontFamily:
                theme?.typography.fontFamily.sans.semibold || "System",
            },
          ]}
        >
          {maxLabel}
        </Text>
        <Ruler
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
