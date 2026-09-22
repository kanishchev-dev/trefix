import { StyleSheet, Text, View } from "react-native";
import { Flag, CheckCircle2 } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressGoal } from "../types/progress-types";
import type { MainCopy } from "../../../locales";

type Props = {
  goal: ProgressGoal;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function GoalProgressCard({ goal, theme, themeMode, copy }: Props) {
  const isDark = themeMode === "dark";

  const statusLabel =
    copy.progress?.goal?.statuses?.[goal.status] ||
    goal.status.replace("_", " ");

  const isAchieved = goal.status === "ACHIEVED";
  const progressPercent = Math.min(Math.max(goal.progress ?? 70, 0), 100);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Flag size={14} color={theme.color.mutedForeground} strokeWidth={2.5} />
          <Text
            style={[
              styles.sectionHeader,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {copy.progress?.goal?.sectionTitle || "YOUR GOAL"}
          </Text>
        </View>

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(9, 9, 11, 0.06)",
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {statusLabel.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.goalTitle,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.extrabold,
          },
        ]}
      >
        {goal.title || goal.distance || "Performance Goal"}
      </Text>

      {/* 3 Metric Columns: Target / Current Estimate / To Go */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCol}>
          <Text
            style={[
              styles.metricValue,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {goal.target}
          </Text>
          <Text
            style={[
              styles.metricLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.progress?.goal?.target || "TARGET"}
          </Text>
        </View>

        <View style={styles.metricCol}>
          <Text
            style={[
              styles.metricValue,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {goal.currentEstimate}
          </Text>
          <Text
            style={[
              styles.metricLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.progress?.goal?.currentEstimate || "CURRENT ESTIMATE"}
          </Text>
        </View>

        <View style={styles.metricCol}>
          <Text
            style={[
              styles.metricValue,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.extrabold,
              },
            ]}
          >
            {goal.delta}
          </Text>
          <Text
            style={[
              styles.metricLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.progress?.goal?.toGo || "TO GO"}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View
        style={[
          styles.progressTrack,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.06)",
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${progressPercent}%`,
              backgroundColor: theme.color.foreground,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeader: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
  },
  goalTitle: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  metricCol: {
    flex: 1,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
