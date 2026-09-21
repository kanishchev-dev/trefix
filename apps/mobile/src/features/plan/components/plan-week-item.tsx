import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { type PlanWeek } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";

type Props = {
  week: PlanWeek;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onPress: (week: PlanWeek) => void;
};

export function PlanWeekItem({
  week,
  theme,
  themeMode,
  copy,
  onPress,
}: Props) {
  const planCopy = copy.plan;
  const isCurrent = week.status === "current";
  const isCompleted = week.status === "completed";

  const phaseLabel =
    planCopy.phases[week.phase] || week.phase;

  const workoutsText = week.plannedWorkoutsCount
    ? planCopy.timeline.workoutsCount.replace(
        "{{count}}",
        String(week.plannedWorkoutsCount),
      )
    : null;

  const distanceText = week.plannedDistance
    ? planCopy.timeline.distanceKm.replace(
        "{{distance}}",
        String(week.plannedDistance),
      )
    : null;

  const summaryText =
    week.summaryText ||
    [workoutsText, distanceText].filter(Boolean).join(" · ");

  const accessibilityText = `${planCopy.timeline.weekLabel.replace("{{number}}", String(week.weekNumber))}. ${
    isCurrent
      ? planCopy.timeline.currentBadge
      : isCompleted
        ? planCopy.timeline.completedBadge
        : planCopy.timeline.upcomingBadge
  }. ${phaseLabel}. ${week.title}.${summaryText ? ` ${summaryText}.` : ""}`;

  return (
    <Pressable
      accessibilityLabel={accessibilityText}
      accessibilityRole="button"
      onPress={() => onPress(week)}
      style={({ pressed }) => [
        styles.container,
        isCurrent && [
          styles.currentContainer,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.border,
          },
        ],
        pressed && styles.pressed,
      ]}
    >
      {/* Node Marker */}
      <View style={styles.nodeWrapper}>
        {isCompleted ? (
          <View
            style={[
              styles.completedNode,
              { backgroundColor: theme.color.surfaceElevated, borderColor: theme.color.border },
            ]}
          >
            <Check color={theme.color.mutedForeground} size={12} strokeWidth={3} />
          </View>
        ) : isCurrent ? (
          <View
            style={[
              styles.currentNodeOuter,
              { borderColor: theme.color.primary },
            ]}
          >
            <View
              style={[
                styles.currentNodeInner,
                { backgroundColor: theme.color.primary },
              ]}
            />
          </View>
        ) : (
          <View
            style={[
              styles.upcomingNode,
              { borderColor: theme.color.border },
            ]}
          />
        )}
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Top Meta Row: Week Number, Phase, Status Badge */}
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <Text
              style={[
                styles.weekNumberText,
                {
                  color: isCurrent
                    ? theme.color.foreground
                    : isCompleted
                      ? theme.color.mutedForeground
                      : theme.color.foreground,
                  fontFamily: isCurrent
                    ? theme.typography.fontFamily.sans.bold
                    : theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {planCopy.timeline.weekLabel.replace("{{number}}", String(week.weekNumber))}
            </Text>

            <View
              style={[
                styles.phaseTag,
                {
                  backgroundColor: isCurrent
                    ? theme.color.surface
                    : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.phaseText,
                  {
                    color: isCurrent
                      ? theme.color.foreground
                      : theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {phaseLabel}
              </Text>
            </View>
          </View>

          {isCurrent ? (
            <View
              style={[
                styles.currentBadge,
                { backgroundColor: theme.color.primary },
              ]}
            >
              <Text
                style={[
                  styles.currentBadgeText,
                  {
                    color: theme.color.primaryForeground,
                    fontFamily: theme.typography.fontFamily.sans.bold,
                  },
                ]}
              >
                {planCopy.timeline.currentBadge}
              </Text>
            </View>
          ) : isCompleted ? (
            <Text
              style={[
                styles.statusText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              ✓
            </Text>
          ) : null}
        </View>

        {/* Title / Focus */}
        <Text
          style={[
            styles.titleText,
            {
              color: isCurrent
                ? theme.color.foreground
                : isCompleted
                  ? theme.color.mutedForeground
                  : theme.color.foreground,
              fontFamily: isCurrent
                ? theme.typography.fontFamily.sans.bold
                : theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {week.title}
        </Text>

        {/* Workouts / Volume summary if present */}
        {summaryText ? (
          <Text
            style={[
              styles.summaryText,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {summaryText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 14,
  },
  currentContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  nodeWrapper: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  completedNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  currentNodeOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  currentNodeInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  upcomingNode: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weekNumberText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
  },
  phaseTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  phaseText: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  statusText: {
    fontSize: 12,
  },
  titleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
