import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { type ValueControlProps } from "./value-control-types";
import { Minus, Plus } from "lucide-react-native";

export type StepperProps = ValueControlProps<number> & {
  unit?: string;
  themeMode?: ThemeMode;
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
  themeMode,
  unit,
}: StepperProps) {
  const isDark =
    themeMode === "dark" ||
    theme?.color.background === "#09090b" ||
    theme?.color.surface === "#111111";

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

  const btnBg = isDark ? "#27272a" : theme?.color.secondary || "#f4f4f5";
  const btnBorder = isDark ? "rgba(255, 255, 255, 0.12)" : theme?.color.border || "#e4e4e7";
  const iconColor = theme?.color.foreground || (isDark ? "#f8fafc" : "#09090b");

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : theme?.color.surface || "#ffffff",
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : theme?.color.border || "#e4e4e7",
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrement"
        disabled={!canDecrement}
        onPress={handleDecrement}
        style={({ pressed }: { pressed: boolean }) => [
          styles.button,
          {
            backgroundColor: btnBg,
            borderColor: btnBorder,
          },
          !canDecrement && styles.buttonDisabled,
          pressed && canDecrement && styles.buttonPressed,
        ]}
      >
        <Minus size={18} color={canDecrement ? iconColor : (isDark ? "#52525b" : "#a1a1aa")} />
      </Pressable>

      <View style={styles.valueContainer}>
        <Text
          style={[
            styles.valueText,
            {
              color: theme?.color.foreground || (isDark ? "#f8fafc" : "#09090b"),
              fontFamily: theme?.typography.fontFamily.sans.bold || "System",
            },
          ]}
        >
          {displayString}
          {unit ? (
            <Text
              style={[
                styles.unitText,
                { color: theme?.color.mutedForeground || (isDark ? "#a1a1aa" : "#71717a") },
              ]}
            >
              {" "}
              {unit}
            </Text>
          ) : null}
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
            backgroundColor: btnBg,
            borderColor: btnBorder,
          },
          !canIncrement && styles.buttonDisabled,
          pressed && canIncrement && styles.buttonPressed,
        ]}
      >
        <Plus size={18} color={canIncrement ? iconColor : (isDark ? "#52525b" : "#a1a1aa")} />
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
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.8,
  },
  valueContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    fontSize: 18,
    lineHeight: 24,
  },
  unitText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
