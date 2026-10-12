import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

type Props = {
  days: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (day: string) => void;
  theme: ThemeTokens;
};

/** Seven round day toggles in one row. */
export function WeekdayPicker({ days, selected, onToggle, theme }: Props) {
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const active = selected.includes(day.value);
        return (
          <Pressable
            key={day.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={day.label}
            onPress={() => onToggle(day.value)}
            style={({ pressed }) => [
              styles.day,
              {
                backgroundColor: active
                  ? theme.color.primary
                  : theme.color.card,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? theme.color.primaryForeground
                    : theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {day.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  day: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
});
