import React, { useRef, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
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

export type WheelProps = ValueControlProps<number> & {
  itemHeight?: number;
  visibleItems?: number;
};

export function Wheel({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  formatValue,
  accessibilityLabel,
  theme,
  itemHeight = 44,
  visibleItems = 5,
}: WheelProps) {
  const effectiveMin = min ?? 0;
  const effectiveMax = max ?? 100;
  const effectiveStep = step ?? 1;

  // Generate valid steps
  const items = useMemo(() => {
    const list: number[] = [];
    for (let v = effectiveMin; v <= effectiveMax; v = Number((v + effectiveStep).toFixed(4))) {
      list.push(v);
    }
    if (list.length === 0) list.push(effectiveMin);
    return list;
  }, [effectiveMin, effectiveMax, effectiveStep]);

  const currentIndex = useMemo(() => {
    let closestIdx = 0;
    let minDiff = Infinity;
    items.forEach((item: number, idx: number) => {
      const diff = Math.abs(item - value);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    return closestIdx;
  }, [items, value]);

  const translateY = useSharedValue(-currentIndex * itemHeight);
  const lastIndexRef = useRef(currentIndex);

  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  useEffect(() => {
    const targetY = -currentIndex * itemHeight;
    translateY.value = withSpring(targetY, { damping: 20, stiffness: 200 });
    lastIndexRef.current = currentIndex;
  }, [currentIndex, itemHeight, translateY]);

  const updateValueFromOffset = useCallback(
    (offsetY: number) => {
      const rawIndex = Math.round(-offsetY / itemHeight);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));
      if (clampedIndex !== lastIndexRef.current) {
        lastIndexRef.current = clampedIndex;
        runOnJS(triggerHaptic)();
        runOnJS(onChange)(items[clampedIndex]);
      }
    },
    [itemHeight, items, onChange, triggerHaptic]
  );

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onChange((event: any) => {
      const currentTranslate = translateY.value + event.changeY;
      const minY = -(items.length - 1) * itemHeight;
      const maxY = 0;
      if (currentTranslate > maxY + itemHeight * 0.5) {
        translateY.value = maxY + itemHeight * 0.5 * 0.3;
      } else if (currentTranslate < minY - itemHeight * 0.5) {
        translateY.value = minY - itemHeight * 0.5 * 0.3;
      } else {
        translateY.value = currentTranslate;
      }
      updateValueFromOffset(translateY.value);
    })
    .onEnd((event: any) => {
      const projected = translateY.value + event.velocityY * 0.1;
      const rawIndex = Math.round(-projected / itemHeight);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));
      const targetY = -clampedIndex * itemHeight;
      translateY.value = withSpring(targetY, { damping: 22, stiffness: 220 });
      lastIndexRef.current = clampedIndex;
      runOnJS(onChange)(items[clampedIndex]);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const containerHeight = itemHeight * visibleItems;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      style={[
        styles.container,
        { height: containerHeight },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View
        style={[
          styles.selectionIndicator,
          {
            height: itemHeight,
            top: (containerHeight - itemHeight) / 2,
            backgroundColor: theme?.color.overlay || "rgba(0,0,0,0.05)",
            borderColor: theme?.color.border || "#e4e4e7",
          },
        ]}
        pointerEvents="none"
      />

      <GestureDetector gesture={panGesture}>
        <View style={styles.gestureArea}>
          <Animated.View style={[styles.wheelList, animatedStyle]}>
            {items.map((item: number, index: number) => {
              const displayString = formatValue ? formatValue(item) : String(item);
              const isSelected = index === currentIndex;
              return (
                <View
                  key={index}
                  style={[styles.itemContainer, { height: itemHeight }]}
                >
                  <Text
                    style={[
                      styles.itemText,
                      {
                        color: isSelected
                          ? theme?.color.foreground || "#09090b"
                          : theme?.color.mutedForeground || "#71717a",
                        fontWeight: isSelected ? "600" : "400",
                        fontSize: isSelected ? 18 : 16,
                      },
                    ]}
                  >
                    {displayString}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  selectionIndicator: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gestureArea: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  wheelList: {
    width: "100%",
    alignItems: "center",
  },
  itemContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  itemText: {
    textAlign: "center",
  },
});
