import { StyleSheet, Text, View } from "react-native";

import { type ActivePlanSummary } from "@trefix/api-client";
import { type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { Notice } from "./plans-ui";

type Props = {
  activePlan: ActivePlanSummary;
  copy: MainCopy;
  language: AppLanguage;
  theme: ThemeTokens;
};

/** Consequences of replacing the plan in progress, shown before a destructive start. */
export function ActivePlanWarning({
  activePlan,
  copy,
  language,
  theme,
}: Props) {
  const warningCopy = copy.plans.warning;
  const bullets = [
    pluralize(
      warningCopy.completedKept,
      activePlan.completedWorkouts,
      language,
    ),
    pluralize(
      warningCopy.plannedRemoved,
      activePlan.futurePlannedWorkouts,
      language,
    ),
  ];

  return (
    <Notice
      tone="warning"
      theme={theme}
      title={fillTemplate(warningCopy.title, {
        name: activePlan.name ?? copy.plans.untitled,
        current: activePlan.currentWeek,
        total: activePlan.totalWeeks,
      })}
    >
      <View style={styles.body}>
        <Text
          style={[
            styles.text,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {warningCopy.body}
        </Text>
        {bullets.map((bullet) => (
          <Text
            key={bullet}
            style={[
              styles.text,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {`• ${bullet}`}
          </Text>
        ))}
      </View>
    </Notice>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 2,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
  },
});
