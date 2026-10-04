import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { type ThemeTokens } from "@workspace/tokens";
import { type ValueControlProps } from "./value-control-types";
import { Plus, Minus } from "lucide-react-native";

export type StepperProps = ValueControlProps<number> & {
  unit?: string;
};

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  disabled = false,
  formatValue,
  accessibilityLabel,
  theme,
  unit,
}: StepperProps) {
  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const handleDecrement = () => {
    if (disabled) return;
    const nextVal = Number((value - step).toFixed(4));
    if (nextVal >= min) {
      triggerHaptic();
      onChange(nextVal);
    }
  };

  const handleIncrement = () => {
    if (disabled) return;
    const nextVal = Number((value + step).toFixed(4));
    if (nextVal <= max) {
      triggerHaptic();
      onChange(nextVal);
    }
  };

  const displayString = formatValue ? formatValue(value) : String(value);

  const canDecrement = value > min && !disabled;
  const canIncrement = value < max && !disabled;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      style={[styles.container, disabled && { opacity: 0.5 }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrement"
        disabled={!canDecrement}
        onPress={handleDecrement}
        style={({ pressed }: { pressed: boolean }) => [
          styles.button,
          {
            backgroundColor: theme?.color.secondary || "#e4e4e7",
            borderColor: theme?.color.border || "#d4d4d8",
          },
          !canDecrement && { opacity: 0.4 },
          pressed && canDecrement && { opacity: 0.7 },
        ]}
      >
        <Minus size={20} color={theme?.color.foreground || "#09090b"} />
      </Pressable>

      <View style={styles.valueContainer}>
        <Text
          style={[
            styles.valueText,
            {
              color: theme?.color.foreground || "#09090b",
              fontFamily: theme?.typography.fontFamily.sans.semibold || "System",
            },
          ]}
        >
          {displayString}
          {unit ? <Text style={styles.unitText}> {unit}</Text> : null}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increment"
        disabled={!canIncrement}
        onPress={handleIncrement}
        style={({ pressed }: { pressed: boolean }) => [
          styles.button,
          {
            backgroundColor: theme?.color.secondary || "#e4e4e7",
            borderColor: theme?.color.border || "#d4d4d8",
          },
          !canIncrement && { opacity: 0.4 },
          pressed && canIncrement && { opacity: 0.7 },
        ]}
      >
        <Plus size={20} color={theme?.color.foreground || "#09090b"} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  valueContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    fontSize: 20,
    lineHeight: 26,
  },
  unitText: {
    fontSize: 14,
    opacity: 0.7,
  },
});
