import { StyleSheet, Text, View } from "react-native";

import { type MetricsSnapshot } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, formatPace, formatShortDate, type AppLanguage, type MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";
import { formatTargetTime } from "../../plan-creation/plan-creation-types";

type Props = {
  snapshot: MetricsSnapshot | null;
  title: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Metrics a plan was built from: threshold pace, volume, longest run, heart rate. */
export function MetricsSnapshotCard({ snapshot, title, theme, themeMode, copy, language }: Props) {
  if (!snapshot) return null;
  const metricsCopy = copy.plans.metrics;

  const parts = [
    snapshot.thresholdPaceSecondsPerKm
      ? `${metricsCopy.threshold} ${formatPace(snapshot.thresholdPaceSecondsPerKm)} ${metricsCopy.paceUnit}`
      : snapshot.recentResult
        ? `${(metricsCopy.distances as Record<string, string>)[snapshot.recentResult.distance] ?? snapshot.recentResult.distance} ${formatTargetTime(snapshot.recentResult.timeSeconds)}`
        : null,
    snapshot.weeklyMileageKm !== null && snapshot.weeklyMileageKm !== undefined
      ? fillTemplate(metricsCopy.weeklyShort, { km: Math.round(snapshot.weeklyMileageKm) })
      : null,
    snapshot.longestRunKm ? fillTemplate(metricsCopy.longestShort, { km: snapshot.longestRunKm }) : null,
    snapshot.maxHeartRate || snapshot.restingHeartRate
      ? fillTemplate(metricsCopy.hrShort, { max: snapshot.maxHeartRate ?? "—", rest: snapshot.restingHeartRate ?? "—" })
      : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <Card size="sm" theme={theme} themeMode={themeMode} style={styles.card}>
      <Text style={[styles.title, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
        {title}
      </Text>
      <View>
        <Text style={[styles.value, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
          {parts.join(" · ")}
        </Text>
        {snapshot.capturedAt ? (
          <Text style={[styles.meta, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
            {fillTemplate(copy.plans.details.capturedAt, { date: formatShortDate(snapshot.capturedAt.slice(0, 10), language) })}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    borderRadius: 28,
    padding: 18,
  },
  title: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
});
