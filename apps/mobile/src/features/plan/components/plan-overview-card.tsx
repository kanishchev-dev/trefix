import { StyleSheet, Text, View } from "react-native";
import { Calendar, Target } from "lucide-react-native";

import { type PlanOverview } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";

type Props = {
  overview: PlanOverview;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

export function PlanOverviewCard({ overview, theme, themeMode, copy }: Props) {
  const { plan } = overview;
  const planCopy = copy.plan;

  // Calculate days to race if targetDate exists
  let daysToRace: number | null = null;
  if (plan.goal.targetDate) {
    const target = new Date(plan.goal.targetDate).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diff > 0) {
      daysToRace = diff;
    }
  }

  // Format target date nicely
  const formattedDate = plan.goal.targetDate
    ? new Date(plan.goal.targetDate).toLocaleDateString(
        themeMode === "dark" ? "ru-RU" : "en-US",
        { day: "numeric", month: "long", year: "numeric" },
      )
    : null;

  const phaseLabel =
    planCopy.phases[plan.currentPhase] || plan.currentPhase;

  const progressPercent = Math.min(100, Math.max(0, Math.round(plan.progress * 100)));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surfaceElevated,
          borderColor: theme.color.border,
        },
      ]}
    >
      {/* Top Header: Goal Title & Badges */}
      <View style={styles.headerRow}>
        <View style={styles.goalSection}>
          <View style={styles.goalBadgeRow}>
            <Target color={theme.color.accent} size={16} />
            <Text
              style={[
                styles.goalDistance,
                {
                  color: theme.color.accent,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {plan.goal.distance}
            </Text>
            {plan.goal.targetTime ? (
              <Text
                style={[
                  styles.goalTime,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.extrabold,
                  },
                ]}
              >
                {plan.goal.targetTime}
              </Text>
            ) : null}
          </View>

          {plan.name ? (
            <Text
              style={[
                styles.planName,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {plan.name}
            </Text>
          ) : null}
        </View>

        {/* Phase Chip */}
        <View
          style={[
            styles.phaseBadge,
            {
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
            },
          ]}
        >
          <Text
            style={[
              styles.phaseBadgeText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {phaseLabel}
          </Text>
        </View>
      </View>

      {/* Target Date / Days to race */}
      {formattedDate ? (
        <View style={styles.dateRow}>
          <Calendar color={theme.color.mutedForeground} size={14} />
          <Text
            style={[
              styles.dateText,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {formattedDate}
          </Text>
          {daysToRace !== null ? (
            <Text
              style={[
                styles.daysToRaceText,
                {
                  color: theme.color.accent,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              · {planCopy.overview.daysToRace.replace("{{days}}", String(daysToRace))}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Progress Bar & Week Status */}
      <View style={styles.progressSection}>
        <View style={styles.progressTextRow}>
          <Text
            style={[
              styles.progressLabel,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {planCopy.overview.weekProgress
              .replace("{{current}}", String(plan.currentWeek))
              .replace("{{total}}", String(plan.totalWeeks))}
          </Text>
          <Text
            style={[
              styles.progressPercent,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {progressPercent}%
          </Text>
        </View>

        {/* Progress Bar Track */}
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: theme.color.surface },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: theme.color.primary,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  goalSection: {
    flex: 1,
    gap: 4,
  },
  goalBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  goalDistance: {
    fontSize: 18,
    lineHeight: 24,
  },
  goalTime: {
    fontSize: 20,
    lineHeight: 26,
  },
  planName: {
    fontSize: 13,
    lineHeight: 18,
  },
  phaseBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  phaseBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    lineHeight: 18,
  },
  daysToRaceText: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressSection: {
    gap: 8,
  },
  progressTextRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  progressPercent: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
});
