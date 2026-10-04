import React, { useCallback, useRef } from "react";
import { StyleSheet, Text, View, LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { type ThemeTokens } from "@workspace/tokens";
import { type ValueControlProps } from "./value-control-types";

export type ScrubberProps = ValueControlProps<number> & {
  unit?: string;
  sensitivity?: number;
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
  unit,
  sensitivity = 1,
}: ScrubberProps) {
  const containerWidthRef = useRef(300);
  const lastEmittedValueRef = useRef(value);

  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const range = max - min;
  const progress = range === 0 ? 0 : Math.max(0, Math.min(1, (value - min) / range));
  const indicatorX = useSharedValue(progress * 280);

  const handleLayout = (e: LayoutChangeEvent) => {
    containerWidthRef.current = e.nativeEvent.layout.width - 32;
  };

  const updateValueFromX = useCallback(
    (x: number) => {
      const width = Math.max(1, containerWidthRef.current);
      const clampedX = Math.max(0, Math.min(width, x));
      const ratio = clampedX / width;
      const rawVal = min + ratio * range;
      const steppedVal = Math.round((rawVal - min) / step) * step + min;
      const clampedVal = Math.max(min, Math.min(max, Number(steppedVal.toFixed(4))));

      if (clampedVal !== lastEmittedValueRef.current) {
        lastEmittedValueRef.current = clampedVal;
        runOnJS(triggerHaptic)();
        runOnJS(onChange)(clampedVal);
      }
    },
    [max, min, range, step, triggerHaptic, onChange]
  );

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onChange((event: any) => {
      const width = containerWidthRef.current;
      const currentX = indicatorX.value + event.changeX * sensitivity;
      const clampedX = Math.max(0, Math.min(width, currentX));
      indicatorX.value = clampedX;
      updateValueFromX(clampedX);
    })
    .onEnd(() => {
      const width = containerWidthRef.current;
      const currentRatio = range === 0 ? 0 : (lastEmittedValueRef.current - min) / range;
      indicatorX.value = withSpring(currentRatio * width, { damping: 20, stiffness: 200 });
    });

  const displayString = formatValue ? formatValue(value) : String(value);

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      onLayout={handleLayout}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      style={[
        styles.container,
        {
          backgroundColor: theme?.color.surfaceElevated || "#ffffff",
          borderColor: theme?.color.border || "#e4e4e7",
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={styles.valueDisplayContainer}>
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
        <Text
          style={[
            styles.hintText,
            { color: theme?.color.mutedForeground || "#71717a" },
          ]}
        >
          ← Drag to adjust →
        </Text>
      </View>

      <GestureDetector gesture={panGesture}>
        <View style={styles.trackContainer}>
          <View
            style={[
              styles.trackBar,
              { backgroundColor: theme?.color.secondary || "#e4e4e7" },
            ]}
          >
            <Animated.View
              style={[
                styles.thumb,
                { backgroundColor: theme?.color.foreground || "#09090b" },
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
    padding: 20,
    gap: 16,
    alignItems: "center",
  },
  valueDisplayContainer: {
    alignItems: "center",
    gap: 4,
  },
  valueText: {
    fontSize: 28,
    lineHeight: 34,
  },
  unitText: {
    fontSize: 16,
    opacity: 0.7,
  },
  hintText: {
    fontSize: 12,
  },
  trackContainer: {
    width: "100%",
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  trackBar: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: "absolute",
    left: -12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
