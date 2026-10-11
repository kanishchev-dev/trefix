import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { resolveTheme } from "./theme";
import { type ValueControlProps } from "./value-control-types";

export type WheelProps = ValueControlProps<number> & {
  itemHeight?: number;
  visibleItems?: number;
  themeMode?: ThemeMode;
};

function WheelItem({
  item,
  index,
  translateY,
  itemHeight,
  formatValue,
  theme,
}: {
  item: number;
  index: number;
  translateY: SharedValue<number>;
  itemHeight: number;
  formatValue?: (v: number) => string;
  theme: ThemeTokens;
}) {
  const itemOffset = index * itemHeight;

  const animatedStyle = useAnimatedStyle(() => {
    const currentCenter = -translateY.value;
    const distance = Math.abs(currentCenter - itemOffset);
    const maxDistance = itemHeight * 2;

    const opacity = interpolate(
      distance,
      [0, itemHeight, maxDistance],
      [1, 0.45, 0.2],
      "clamp",
    );

    const scale = interpolate(
      distance,
      [0, itemHeight, maxDistance],
      [1, 0.9, 0.82],
      "clamp",
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const displayString = formatValue ? formatValue(item) : String(item);

  return (
    <Animated.View
      style={[styles.itemContainer, { height: itemHeight }, animatedStyle]}
    >
      <Text
        style={[
          styles.itemText,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.bold,
            fontSize: 18,
          },
        ]}
      >
        {displayString}
      </Text>
    </Animated.View>
  );
}

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
  themeMode,
  itemHeight = 40,
  visibleItems = 3,
}: WheelProps) {
  const t = resolveTheme(theme, themeMode);

  const effectiveMin = min ?? 0;
  const effectiveMax = max ?? 100;
  const effectiveStep = step ?? 1;

  const items = useMemo(() => {
    const list: number[] = [];
    for (
      let v = effectiveMin;
      v <= effectiveMax;
      v = Number((v + effectiveStep).toFixed(4))
    ) {
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

  const triggerHaptic = useCallback(() => {
    // Haptics are optional (simulator, disabled in settings); a failure must not surface.
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    const targetY = -currentIndex * itemHeight;
    translateY.value = withSpring(targetY, { damping: 22, stiffness: 220 });
  }, [currentIndex, itemHeight, translateY]);

  const commitIndex = useCallback(
    (index: number) => {
      const val = items[index];
      if (val !== undefined) {
        triggerHaptic();
        onChange(val);
      }
    },
    [items, onChange, triggerHaptic],
  );

  const itemsLength = items.length;

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onChange((event) => {
      "worklet";
      const currentTranslate = translateY.value + event.changeY;
      const minY = -(itemsLength - 1) * itemHeight;
      const maxY = 0;
      if (currentTranslate > maxY + itemHeight * 0.5) {
        translateY.value = maxY + itemHeight * 0.5 * 0.3;
      } else if (currentTranslate < minY - itemHeight * 0.5) {
        translateY.value = minY - itemHeight * 0.5 * 0.3;
      } else {
        translateY.value = currentTranslate;
      }
    })
    .onEnd((event) => {
      "worklet";
      const projected = translateY.value + event.velocityY * 0.08;
      const rawIndex = Math.round(-projected / itemHeight);
      const clampedIndex = Math.max(0, Math.min(itemsLength - 1, rawIndex));
      const targetY = -clampedIndex * itemHeight;
      translateY.value = withSpring(targetY, { damping: 24, stiffness: 240 });
      runOnJS(commitIndex)(clampedIndex);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const containerHeight = itemHeight * visibleItems;
  const topOffset = (containerHeight - itemHeight) / 2;

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
            top: topOffset,
            backgroundColor: t.color.selectionFill,
            borderColor: t.color.selectionBorder,
          },
        ]}
        pointerEvents="none"
      />

      <GestureDetector gesture={panGesture}>
        <View style={[styles.gestureArea, { height: containerHeight }]}>
          <Animated.View
            style={[styles.wheelList, { top: topOffset }, animatedStyle]}
          >
            {items.map((item: number, index: number) => (
              <WheelItem
                key={index}
                item={item}
                index={index}
                translateY={translateY}
                itemHeight={itemHeight}
                formatValue={formatValue}
                theme={t}
              />
            ))}
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
    left: 4,
    right: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 0,
  },
  gestureArea: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  wheelList: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
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
