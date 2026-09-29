import { Pressable, StyleSheet, Text, View } from "react-native";
import { Trophy } from "lucide-react-native";

import { type PlanOverview, type PlanWeek } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { PlanOverviewCard } from "./plan-overview-card";
import { PlanTimeline } from "./plan-timeline";
import { type MainCopy } from "../../../locales";

type Props = {
  overview: PlanOverview;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onSelectWeek: (week: PlanWeek) => void;
  onNewGoal: () => void;
};

export function PlanCompletedState({
  overview,
  theme,
  themeMode,
  copy,
  onSelectWeek,
  onNewGoal,
}: Props) {
  const completedCopy = copy.plan.completedState;

  return (
    <View style={styles.container}>
      {/* Celebration Banner */}
      <View
        style={[
          styles.banner,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.border,
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <Trophy color={theme.color.accent} size={28} />
        </View>

        <Text
          style={[
            styles.bannerTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          {completedCopy.title}
        </Text>

        <Text
          style={[
            styles.bannerDesc,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {completedCopy.description.replace(
            "{{total}}",
            String(overview.plan.totalWeeks),
          )}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={onNewGoal}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.color.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              {
                color: theme.color.primaryForeground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {completedCopy.newGoalButton}
          </Text>
        </Pressable>
      </View>

      <PlanOverviewCard
        copy={copy}
        overview={overview}
        theme={theme}
        themeMode={themeMode}
      />

      <PlanTimeline
        copy={copy}
        onSelectWeek={onSelectWeek}
        theme={theme}
        themeMode={themeMode}
        weeks={overview.weeks}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  banner: {
    padding: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
  },
  bannerDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  button: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 20,
  },
});
