import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { type ThemeTokens } from "@workspace/tokens";
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
  accessibilityLabel?: string;
};

export function Compound({
  parts,
  onChangePart,
  separator = ":",
  unit,
  theme,
  accessibilityLabel,
}: CompoundProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
    >
      <View style={styles.partsRow}>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {index > 0 ? (
              <Text
                style={[
                  styles.separator,
                  { color: theme?.color.foreground || "#09090b" },
                ]}
              >
                {separator}
              </Text>
            ) : null}
            <View style={styles.wheelColumn}>
              <Text
                style={[
                  styles.partLabel,
                  { color: theme?.color.mutedForeground || "#71717a" },
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
            { color: theme?.color.mutedForeground || "#71717a" },
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
    gap: 12,
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
    maxWidth: 100,
  },
  partLabel: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  separator: {
    fontSize: 24,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  unitText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
