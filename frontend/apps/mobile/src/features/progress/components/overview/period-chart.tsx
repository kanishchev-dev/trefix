import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

import {
  type ProgressMetric,
  type ProgressPeriod,
} from "../../data/progress-model";
import { type ProgressBucket } from "../../lib/progress-selectors";
import {
  bucketAxisLabel,
  bucketTipText,
  type ProgressTextContext,
} from "../../lib/progress-text";
import { fonts, progressPalette } from "../progress-ui";

const CHART_HEIGHT = 124;
const BAR_MAX = 96;
const GAP: Record<ProgressPeriod, number> = {
  week: 12,
  month: 3,
  year: 8,
  all: 12,
};

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  period: ProgressPeriod;
  metric: ProgressMetric;
  buckets: ProgressBucket[];
  selected: number;
  onSelect: (index: number) => void;
};

/** Bars of the period; tap a bar to read its value in the line above. */
export function PeriodChart({
  theme,
  ctx,
  period,
  metric,
  buckets,
  selected,
  onSelect,
}: Props) {
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value ?? 0));
  const current = buckets[selected];

  return (
    <View>
      <Text
        accessibilityLiveRegion="polite"
        numberOfLines={1}
        style={[styles.tip, { color: palette.fg, fontFamily: font.medium }]}
      >
        {current ? bucketTipText(ctx, current, metric) : ""}
      </Text>
      <View style={[styles.bars, { gap: GAP[period] }]}>
        {buckets.map((bucket, index) => {
          const isSelected = index === selected;
          const label = bucketAxisLabel(ctx, bucket, index, buckets.length);
          let height = 0;
          let background = palette.faint;
          let dashed = false;
          if (bucket.state !== "value" || bucket.value === null) {
            height = 8;
            background = "transparent";
            dashed = true;
          } else if (bucket.value === 0) {
            height = 2;
            background = isSelected ? palette.muted : palette.faint;
          } else {
            height = Math.max(4, Math.round((bucket.value / max) * BAR_MAX));
            background = isSelected ? palette.fg : palette.faint;
          }
          return (
            <Pressable
              key={bucket.key}
              accessibilityRole="button"
              accessibilityLabel={bucketTipText(ctx, bucket, metric)}
              accessibilityState={{ selected: isSelected }}
              hitSlop={{ top: 8, bottom: 8 }}
              onPress={() => onSelect(index)}
              style={styles.column}
            >
              <View
                style={[
                  styles.bar,
                  { height, backgroundColor: background },
                  dashed && {
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: palette.faint,
                  },
                ]}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.axis,
                  {
                    color: isSelected ? palette.fg : palette.muted,
                    fontFamily: font.regular,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { marginTop: 22, textAlign: "center", fontSize: 13, lineHeight: 18 },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CHART_HEIGHT,
    marginTop: 10,
  },
  column: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  },
  bar: { width: "100%", borderRadius: 4 },
  axis: {
    width: 32,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 12,
    height: 12,
  },
});
