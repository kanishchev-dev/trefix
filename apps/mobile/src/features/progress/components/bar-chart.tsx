import { StyleSheet, View } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  values: Array<number | null>;
  height?: number;
  /** For pace: a smaller value is better and is drawn taller. */
  invert?: boolean;
  theme: ThemeTokens;
  accessibilityLabel: string;
};

/** Vertical bars; the last one is highlighted as the current bucket. */
export function BarChart({
  values,
  height = 96,
  invert = false,
  theme,
  accessibilityLabel,
}: Props) {
  const present = values.filter(
    (value): value is number => value !== null && value > 0,
  );
  const max = present.length > 0 ? Math.max(...present) : 1;
  const min = present.length > 0 ? Math.min(...present) : 0;
  const ratio = (value: number) => {
    if (!invert) return value / max;
    // Faster pace → taller bar; keep a visible floor.
    const span = max - min || 1;
    return 0.35 + 0.65 * ((max - value) / span);
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { height }]}
    >
      {values.map((value, index) => {
        const isLast = index === values.length - 1;
        if (value === null || value <= 0) {
          return (
            <View
              key={index}
              style={[styles.empty, { borderColor: theme.color.border }]}
            />
          );
        }
        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: `${Math.max(4, Math.round(ratio(value) * 100))}%`,
                backgroundColor: isLast
                  ? theme.color.foreground
                  : theme.color.border,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  bar: {
    flex: 1,
    borderRadius: 4,
  },
  empty: {
    flex: 1,
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
