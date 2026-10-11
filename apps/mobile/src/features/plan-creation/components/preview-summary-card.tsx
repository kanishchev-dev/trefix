import { Text, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";
import { styles } from "../plan-preview-screen.styles";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  goalSummary: string;
  totalWeeks: number;
  trainingFrequency: number;
  totalDistanceKm: number;
  /** Formatted start date; a draft without dates has none. */
  startsOn: string | null;
};

/** Goal, plan length, runs per week and total distance of the previewed plan. */
export function PreviewSummaryCard({
  theme,
  themeMode,
  copy,
  goalSummary,
  totalWeeks,
  trainingFrequency,
  totalDistanceKm,
  startsOn,
}: Props) {
  const previewCopy = copy.plan.creation.preview;
  const { regular, medium, semibold } = theme.typography.fontFamily.sans;
  const stats = [
    { value: String(totalWeeks), label: previewCopy.statWeeks },
    { value: String(trainingFrequency), label: previewCopy.statRuns },
    {
      value: `${Math.round(totalDistanceKm)}`,
      label: previewCopy.statDistance,
    },
  ];

  return (
    <Card
      size="sm"
      theme={theme}
      themeMode={themeMode}
      style={styles.summaryCard}
    >
      <Text
        style={[
          styles.summaryTitle,
          { color: theme.color.foreground, fontFamily: medium },
        ]}
      >
        {goalSummary}
      </Text>
      <View style={styles.summaryStats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text
              style={[
                styles.statValue,
                { color: theme.color.foreground, fontFamily: semibold },
              ]}
            >
              {stat.value}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: theme.color.mutedForeground, fontFamily: regular },
              ]}
            >
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
      {startsOn ? (
        <Text
          style={[
            styles.summaryMeta,
            { color: theme.color.mutedForeground, fontFamily: regular },
          ]}
        >
          {fillTemplate(previewCopy.startsOn, { date: startsOn })}
        </Text>
      ) : null}
    </Card>
  );
}
