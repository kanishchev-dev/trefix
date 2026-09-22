import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type {
  ProgressPerformanceMetric,
  ProgressPerformancePoint,
} from "../types/progress-types";

type Props = {
  metric: ProgressPerformanceMetric;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
};

export function PerformanceChart({ metric, theme, themeMode }: Props) {
  const isDark = themeMode === "dark";
  const points = metric.dataPoints;

  const [selectedIndex, setSelectedIndex] = useState<number>(
    points.length - 1
  );

  if (!points || points.length === 0) {
    return null;
  }

  // Calculate min & max for vertical scaling
  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1;

  const selectedPoint: ProgressPerformancePoint =
    points[selectedIndex] || points[points.length - 1];

  return (
    <View style={styles.chartContainer}>
      {/* Active Selected Point Info Header */}
      <View style={styles.selectedPointHeader}>
        <View>
          <Text
            style={[
              styles.selectedPointValue,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.extrabold,
              },
            ]}
          >
            {selectedPoint.label || `${selectedPoint.value} ${metric.unit}`}
          </Text>
          <Text
            style={[
              styles.selectedPointDate,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {selectedPoint.date}
          </Text>
        </View>

        {metric.changePercent !== undefined ? (
          <View
            style={[
              styles.changeBadge,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(9, 9, 11, 0.06)",
              },
            ]}
          >
            <Text
              style={[
                styles.changeText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {metric.changePercent > 0
                ? `+${metric.changePercent}%`
                : `${metric.changePercent}%`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Chart Canvas Area */}
      <View
        style={[
          styles.plotArea,
          {
            borderColor: theme.color.border,
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.02)"
              : "rgba(0, 0, 0, 0.015)",
          },
        ]}
      >
        {/* Render bar / line bars for points */}
        <View style={styles.barsRow}>
          {points.map((pt, idx) => {
            const isSelected = idx === selectedIndex;
            // Normalize height between 20% and 100%
            const heightPercent =
              20 + Math.round(((pt.value - minVal) / valRange) * 80);

            return (
              <Pressable
                key={idx}
                accessibilityRole="button"
                onPress={() => setSelectedIndex(idx)}
                style={styles.barSlot}
              >
                <View style={styles.barFillWrap}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${heightPercent}%`,
                        backgroundColor: isSelected
                          ? theme.color.foreground
                          : isDark
                            ? "rgba(255, 255, 255, 0.25)"
                            : "rgba(9, 9, 11, 0.2)",
                      },
                    ]}
                  />
                </View>
                {isSelected ? (
                  <View
                    style={[
                      styles.dotIndicator,
                      { backgroundColor: theme.color.foreground },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Time X-Axis */}
        <View style={styles.xAxis}>
          {points.map((pt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <Text
                key={idx}
                style={[
                  styles.xLabel,
                  {
                    color: isSelected
                      ? theme.color.foreground
                      : theme.color.mutedForeground,
                    fontFamily: isSelected
                      ? theme.typography.fontFamily.sans.bold
                      : theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {pt.date}
              </Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    marginTop: 8,
  },
  selectedPointHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  selectedPointValue: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  selectedPointDate: {
    fontSize: 12,
    lineHeight: 16,
  },
  changeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeText: {
    fontSize: 12,
    lineHeight: 15,
  },
  plotArea: {
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  barsRow: {
    height: 120,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  barSlot: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 4,
  },
  barFillWrap: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barFill: {
    width: 14,
    borderRadius: 7,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  xAxis: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128, 128, 128, 0.2)",
  },
  xLabel: {
    fontSize: 10,
    lineHeight: 13,
  },
});
