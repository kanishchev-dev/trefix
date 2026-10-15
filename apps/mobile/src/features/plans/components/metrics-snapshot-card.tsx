import { StyleSheet, Text, View } from "react-native";

import { type MetricsSnapshot } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  formatPace,
  formatShortDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { formatTargetTime } from "../../plan-creation/plan-creation-types";

type Props = {
  snapshot: MetricsSnapshot | null;
  title: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Metrics a plan was built from: a section title and a card of label/value rows. */
export function MetricsSnapshotCard({
  snapshot,
  title,
  theme,
  copy,
  language,
}: Props) {
  if (!snapshot) return null;
  const metricsCopy = copy.plans.metrics;
  const distances = metricsCopy.distances as Record<string, string>;

  const rows: Array<{ label: string; value: string }> = [];
  if (snapshot.thresholdPaceSecondsPerKm) {
    rows.push({
      label: metricsCopy.threshold,
      value: `${formatPace(snapshot.thresholdPaceSecondsPerKm)} ${metricsCopy.paceUnit}`,
    });
  } else if (snapshot.recentResult) {
    rows.push({
      label: metricsCopy.recentResult,
      value: `${distances[snapshot.recentResult.distance] ?? snapshot.recentResult.distance} · ${formatTargetTime(snapshot.recentResult.timeSeconds)}`,
    });
  }
  if (
    snapshot.weeklyMileageKm !== null &&
    snapshot.weeklyMileageKm !== undefined
  ) {
    rows.push({
      label: metricsCopy.weeklyKm,
      value: String(Math.round(snapshot.weeklyMileageKm)),
    });
  }
  if (snapshot.longestRunKm) {
    rows.push({
      label: metricsCopy.longestRun,
      value: String(snapshot.longestRunKm),
    });
  }
  if (snapshot.maxHeartRate) {
    rows.push({
      label: metricsCopy.hrMax,
      value: `${snapshot.maxHeartRate} ${metricsCopy.bpm}`,
    });
  }
  if (snapshot.restingHeartRate) {
    rows.push({
      label: metricsCopy.hrRest,
      value: `${snapshot.restingHeartRate} ${metricsCopy.bpm}`,
    });
  }

  if (rows.length === 0) return null;
  const medium = theme.typography.fontFamily.sans.medium;
  const regular = theme.typography.fontFamily.sans.regular;

  return (
    <View style={styles.root}>
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          { color: theme.color.foreground, fontFamily: medium },
        ]}
      >
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.color.card }]}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            accessible
            style={[
              styles.row,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.color.separator,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: theme.color.mutedForeground, fontFamily: regular },
              ]}
            >
              {row.label}
            </Text>
            <Text
              style={[
                styles.value,
                { color: theme.color.foreground, fontFamily: medium },
              ]}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
      {snapshot.capturedAt ? (
        <Text
          style={[
            styles.meta,
            { color: theme.color.mutedForeground, fontFamily: regular },
          ]}
        >
          {fillTemplate(copy.plans.details.capturedAt, {
            date: formatShortDate(snapshot.capturedAt.slice(0, 10), language),
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 2,
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  meta: {
    marginTop: -4,
    paddingHorizontal: 2,
    fontSize: 12,
    lineHeight: 16,
  },
});
