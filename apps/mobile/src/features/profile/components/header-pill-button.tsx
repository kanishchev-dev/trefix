import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

/** Filled "Save" pill on the right of a screen header. */
export function HeaderPillButton({
  theme,
  label,
  onPress,
  disabled = false,
  pending = false,
}: {
  theme: ThemeTokens;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      disabled={disabled || pending}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: theme.color.foreground },
        (disabled || pending) && styles.dimmed,
        pressed && styles.pressed,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={theme.color.card} />
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: theme.color.card,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 84,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
  },
  dimmed: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.82,
  },
});
