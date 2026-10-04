import React, { useCallback, useEffect, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

export type SegmentItem<T> = {
  label: string;
  value: T;
};

export type SegmentedProps<T> = {
  segments: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  theme?: ThemeTokens;
  themeMode?: ThemeMode;
};

export function Segmented<T>({
  segments,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
  theme,
  themeMode,
}: SegmentedProps<T>) {
  const isDark =
    themeMode === "dark" ||
    theme?.color.background === "#09090b" ||
    theme?.color.surface === "#111111";

  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    segments.findIndex((s) => s.value === value)
  );

  const activeX = useSharedValue(activeIndex);

  useEffect(() => {
    activeX.value = withSpring(activeIndex, {
      damping: 22,
      stiffness: 240,
      mass: 0.8,
    });
  }, [activeIndex, activeX]);

  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const indicatorWidth =
    containerWidth > 8 ? (containerWidth - 8) / segments.length : 0;

  const indicatorStyle = useAnimatedStyle(() => {
    if (indicatorWidth === 0) return { opacity: 0 };
    return {
      width: indicatorWidth,
      transform: [
        {
          translateX: interpolate(
            activeX.value,
            [0, Math.max(1, segments.length - 1)],
            [4, 4 + (segments.length - 1) * indicatorWidth]
          ),
        },
      ],
    };
  });

  const bgContainer = isDark
    ? "rgba(255, 255, 255, 0.05)"
    : theme?.color.secondary || "#f4f4f5";

  const activePillBg = isDark
    ? "#27272a"
    : theme?.color.surface || "#ffffff";

  const activeBorder = isDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.08)";

  return (
    <View
      onLayout={handleLayout}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={[
        styles.container,
        {
          backgroundColor: bgContainer,
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : theme?.color.border || "#e4e4e7",
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      {indicatorWidth > 0 ? (
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              backgroundColor: activePillBg,
              borderColor: activeBorder,
              borderWidth: StyleSheet.hairlineWidth,
            },
            indicatorStyle,
          ]}
        />
      ) : null}

      {segments.map((segment, index) => {
        const isSelected = index === activeIndex;
        return (
          <Pressable
            key={index}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            disabled={disabled}
            onPress={() => {
              if (!isSelected) {
                triggerHaptic();
                onChange(segment.value);
              }
            }}
            style={({ pressed }) => [
              styles.segment,
              pressed && !disabled && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isSelected
                    ? theme?.color.foreground || (isDark ? "#f8fafc" : "#09090b")
                    : theme?.color.mutedForeground || (isDark ? "#a1a1aa" : "#71717a"),
                  fontFamily: isSelected
                    ? theme?.typography.fontFamily.sans.bold || "System"
                    : theme?.typography.fontFamily.sans.medium || "System",
                },
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    width: "100%",
    position: "relative",
    alignItems: "center",
  },
  activeIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
});
