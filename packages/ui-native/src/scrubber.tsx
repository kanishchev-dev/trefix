import React, { useCallback, useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { type ValueControlProps } from "./value-control-types";

export type ScrubberProps = ValueControlProps<number> & {
  unit?: string;
  sensitivity?: number;
  themeMode?: ThemeMode;
};

export function Scrubber({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  formatValue,
  accessibilityLabel,
  theme,
  themeMode,
  unit,
  sensitivity = 1,
}: ScrubberProps) {
  const isDark =
    themeMode === "dark" ||
    theme?.color.background === "#09090b" ||
    theme?.color.surface === "#111111";

  const containerWidth = useSharedValue(280);
  const [displayVal, setDisplayVal] = useState(value);

  useEffect(() => {
    setDisplayVal(value);
  }, [value]);

  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const range = max - min;
  const initialRatio = range === 0 ? 0 : Math.max(0, Math.min(1, (value - min) / range));
  const indicatorX = useSharedValue(initialRatio * 280);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = Math.max(1, e.nativeEvent.layout.width - 40);
    containerWidth.value = width;
    const currentRatio = range === 0 ? 0 : Math.max(0, Math.min(1, (value - min) / range));
    indicatorX.value = currentRatio * width;
  };

  const updateDisplayValue = useCallback((val: number) => {
    setDisplayVal(val);
  }, []);

  const commitValue = useCallback(
    (val: number) => {
      triggerHaptic();
      onChange(val);
    },
    [onChange, triggerHaptic]
  );

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onChange((event) => {
      "worklet";
      const width = containerWidth.value;
      const currentX = indicatorX.value + event.changeX * sensitivity;
      const clampedX = Math.max(0, Math.min(width, currentX));
      indicatorX.value = clampedX;

      const ratio = width > 0 ? clampedX / width : 0;
      const rawVal = min + ratio * (max - min);
      const steppedVal = Math.round((rawVal - min) / step) * step + min;
      const clampedVal = Math.max(min, Math.min(max, steppedVal));

      runOnJS(updateDisplayValue)(clampedVal);
    })
    .onEnd(() => {
      "worklet";
      const width = containerWidth.value;
      const ratio = width > 0 ? indicatorX.value / width : 0;
      const rawVal = min + ratio * (max - min);
      const steppedVal = Math.round((rawVal - min) / step) * step + min;
      const finalVal = Math.max(min, Math.min(max, steppedVal));

      const finalRatio = max - min === 0 ? 0 : (finalVal - min) / (max - min);
      indicatorX.value = withSpring(finalRatio * width, { damping: 22, stiffness: 220 });
      runOnJS(commitValue)(finalVal);
    });

  const displayString = formatValue ? formatValue(displayVal) : String(displayVal);

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const activeTrackAnimatedStyle = useAnimatedStyle(() => ({
    width: indicatorX.value,
  }));

  const cardBg = isDark ? "#121214" : theme?.color.surface || "#ffffff";
  const borderCol = isDark ? "rgba(255, 255, 255, 0.08)" : theme?.color.border || "rgba(0, 0, 0, 0.08)";
  const trackBg = isDark ? "rgba(255, 255, 255, 0.12)" : theme?.color.secondary || "#e4e4e7";
  const activeTrackBg = theme?.color.primary || (isDark ? "#f8fafc" : "#09090b");
  const thumbBg = isDark ? "#ffffff" : theme?.color.primary || "#09090b";

  return (
    <View
      onLayout={handleLayout}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      style={[
        styles.container,
        {
          backgroundColor: cardBg,
          borderColor: borderCol,
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={styles.valueDisplayContainer}>
        <Text
          style={[
            styles.valueText,
            {
              color: theme?.color.foreground || (isDark ? "#f8fafc" : "#09090b"),
              fontFamily: theme?.typography.fontFamily.sans.extrabold || "System",
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

      <GestureDetector gesture={panGesture}>
        <View style={styles.trackContainer}>
          <View style={[styles.trackBar, { backgroundColor: trackBg }]}>
            <Animated.View
              style={[
                styles.activeTrack,
                { backgroundColor: activeTrackBg },
                activeTrackAnimatedStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.thumb,
                { backgroundColor: thumbBg },
                thumbAnimatedStyle,
              ]}
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    alignItems: "center",
  },
  valueDisplayContainer: {
    alignItems: "center",
    gap: 2,
  },
  valueText: {
    fontSize: 26,
    lineHeight: 32,
  },
  unitText: {
    fontSize: 15,
    lineHeight: 20,
  },
  trackContainer: {
    width: "100%",
    height: 36,
    justifyContent: "center",
  },
  trackBar: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    position: "relative",
    justifyContent: "center",
    overflow: "visible",
  },
  activeTrack: {
    height: "100%",
    borderRadius: 4,
    position: "absolute",
    left: 0,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: "absolute",
    left: -12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
