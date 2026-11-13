import { StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

export type StatTile = { value: string; unit?: string; label: string };

type Props = {
  tiles: StatTile[];
  theme: ThemeTokens;
  /** Tile fill: `secondary` inside sheets and cards, `card` on the grey screen. */
  tone?: "secondary" | "card";
};

/** Equal summary tiles that clip rather than push: "18/48 км", "2 из 5", "3". */
export function StatTiles({ tiles, theme, tone = "secondary" }: Props) {
  const medium = theme.typography.fontFamily.sans.medium;
  const muted = theme.color.mutedForeground;
  return (
    <View style={styles.row}>
      {tiles.map((tile) => (
        <View
          key={tile.label}
          accessible
          accessibilityLabel={`${tile.label}: ${tile.value}${tile.unit ? ` ${tile.unit}` : ""}`}
          style={[
            styles.tile,
            {
              backgroundColor:
                tone === "card" ? theme.color.card : theme.color.secondary,
            },
          ]}
        >
          <View style={styles.valueRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.value,
                { color: theme.color.foreground, fontFamily: medium },
              ]}
            >
              {tile.value}
            </Text>
            {tile.unit ? (
              <Text style={[styles.unit, { color: muted, fontFamily: medium }]}>
                {tile.unit}
              </Text>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: muted,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {tile.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    borderRadius: 16,
    padding: 12,
    gap: 2,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  value: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    marginLeft: 3,
    fontSize: 12,
    lineHeight: 16,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
});
