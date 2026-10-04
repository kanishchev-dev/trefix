import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { type ThemeTokens } from "@workspace/tokens";

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
};

export function Segmented<T>({
  segments,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
  theme,
}: SegmentedProps<T>) {
  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={[
        styles.container,
        {
          backgroundColor: theme?.color.secondary || "#e4e4e7",
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      {segments.map((segment, index) => {
        const isSelected = segment.value === value;
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
            style={[
              styles.segment,
              isSelected && {
                backgroundColor: theme?.color.surface || "#ffffff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isSelected
                    ? theme?.color.foreground || "#09090b"
                    : theme?.color.mutedForeground || "#71717a",
                  fontFamily: theme?.typography.fontFamily.sans.semibold || "System",
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
    padding: 4,
    width: "100%",
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
});
