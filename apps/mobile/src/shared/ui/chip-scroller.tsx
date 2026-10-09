import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";

/** Single-row horizontal list of chips running to the screen edge; never wraps into rows. */
export function ChipScroller({ children, inset = 16 }: { children: ReactNode; inset?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -inset }}
      contentContainerStyle={[styles.content, { paddingHorizontal: inset }]}
    >
      {children}
    </ScrollView>
  );
}

export function Chip({
  theme,
  label,
  selected,
  onPress,
  icon,
}: {
  theme: ThemeTokens;
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.color.primary : theme.color.control },
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: selected ? theme.color.primaryForeground : theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
});
