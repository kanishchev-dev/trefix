import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { resolveTheme } from "./theme";
import { Wheel } from "./wheel";

export type CompoundPart = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (v: number) => string;
};

export type CompoundProps = {
  parts: CompoundPart[];
  onChangePart: (partIndex: number, newValue: number) => void;
  separator?: string;
  unit?: string;
  theme?: ThemeTokens;
  themeMode?: ThemeMode;
  accessibilityLabel?: string;
};

export function Compound({
  parts,
  onChangePart,
  separator = ":",
  unit,
  theme,
  themeMode,
  accessibilityLabel,
}: CompoundProps) {
  const t = resolveTheme(theme, themeMode);

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
      <View style={styles.partsRow}>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {index > 0 ? (
              <Text style={[styles.separator, { color: t.color.foreground }]}>
                {separator}
              </Text>
            ) : null}
            <View style={styles.wheelColumn}>
              <Text
                style={[
                  styles.partLabel,
                  {
                    color: t.color.mutedForeground,
                    fontFamily:
                      theme?.typography.fontFamily.sans.bold || "System",
                  },
                ]}
              >
                {part.label}
              </Text>
              <Wheel
                value={part.value}
                onChange={(val) => onChangePart(index, val)}
                min={part.min}
                max={part.max}
                step={part.step ?? 1}
                formatValue={part.formatValue}
                theme={theme}
                themeMode={themeMode}
                visibleItems={3}
                itemHeight={40}
              />
            </View>
          </React.Fragment>
        ))}
      </View>
      {unit ? (
        <Text
          style={[
            styles.unitText,
            {
              color: t.color.mutedForeground,
              fontFamily:
                theme?.typography.fontFamily.sans.semibold || "System",
            },
          ]}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  partsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  wheelColumn: {
    flex: 1,
    alignItems: "center",
    maxWidth: 90,
  },
  partLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  separator: {
    fontSize: 22,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingTop: 18,
  },
  unitText: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
