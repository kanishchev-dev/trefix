import { Pressable, StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  theme: ThemeTokens;
  accessibilityLabel: string;
};

/** Compact − value + control on a sunken surface. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  theme,
  accessibilityLabel,
}: Props) {
  const button = (direction: -1 | 1) => {
    const disabled = direction < 0 ? value <= min : value >= max;
    const Icon = direction < 0 ? Minus : Plus;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel} ${direction < 0 ? "−" : "+"}`}
        disabled={disabled}
        hitSlop={6}
        onPress={() => onChange(value + direction)}
        style={({ pressed }) => [
          styles.button,
          (pressed || disabled) && { opacity: disabled ? 0.35 : 0.7 },
        ]}
      >
        <Icon color={theme.color.foreground} size={16} strokeWidth={2.4} />
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      style={[styles.root, { backgroundColor: theme.color.surface }]}
    >
      {button(-1)}
      <Text
        style={[
          styles.value,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
          },
        ]}
      >
        {value}
      </Text>
      {button(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    paddingHorizontal: 4,
  },
  button: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 20,
  },
});
