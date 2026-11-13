import { StyleSheet, Text, View } from "react-native";
import { Clock } from "lucide-react-native";

import { type PlanOverview } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { PlanOverviewCard } from "./plan-overview-card";
import { PlanTimeline } from "./plan-timeline";
import { type PlanWeekView } from "../../plans/lib/plan-weeks";
import {
  formatDateLong,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";

type Props = {
  overview: PlanOverview;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onSelectWeek: (week: PlanWeekView) => void;
  /** Overview weeks with texts in the app language. */
  weeks: PlanWeekView[];
};

export function PlanNotStartedState({
  overview,
  theme,
  themeMode,
  copy,
  language,
  onSelectWeek,
  weeks,
}: Props) {
  const notStartedCopy = copy.plan.notStartedState;
  const formattedStartDate = overview.plan.startDate
    ? formatDateLong(new Date(overview.plan.startDate), language)
    : "";

  return (
    <View style={styles.container}>
      {/* Banner */}
      <View
        style={[
          styles.banner,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.border,
          },
        ]}
      >
        <View style={styles.iconRow}>
          <Clock color={theme.color.accent} size={20} />
          <Text
            style={[
              styles.bannerTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {notStartedCopy.title}
          </Text>
        </View>

        <Text
          style={[
            styles.bannerSubtitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {notStartedCopy.subtitle.replace("{{date}}", formattedStartDate)}
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
          {notStartedCopy.description}
        </Text>
      </View>

      {/* Plan Goal Overview */}
      <PlanOverviewCard
        copy={copy}
        language={language}
        overview={overview}
        theme={theme}
        themeMode={themeMode}
      />

      {/* Full Timeline */}
      <PlanTimeline
        copy={copy}
        onSelectWeek={onSelectWeek}
        theme={theme}
        themeMode={themeMode}
        weeks={weeks}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  banner: {
    padding: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  bannerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  bannerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
