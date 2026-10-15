import { StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";
import { formatMinutesSeconds } from "@trefix/utils";

import { fillTemplate, formatDayMonth } from "../../../../locales";
import {
  type ProgressAnalytics,
  type ProgressPlanKeyWorkout,
} from "../../data/progress-model";
import { type ProgressTextContext } from "../../lib/progress-text";
import {
  Caption,
  DemoBadge,
  Kicker,
  ProgressCard,
  SectionHeader,
  fonts,
  progressPalette,
  progressStyles,
} from "../progress-ui";

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  analytics: ProgressAnalytics;
};

function plannedText(
  ctx: ProgressTextContext,
  item: ProgressPlanKeyWorkout,
): string {
  return item.planned.kind === "distance"
    ? ctx.format.distance(item.planned.km, 0)
    : `${formatMinutesSeconds(item.planned.fromSec)}–${formatMinutesSeconds(item.planned.toSec)}`;
}

function actualText(
  ctx: ProgressTextContext,
  item: ProgressPlanKeyWorkout,
): string {
  if (!item.actual)
    return ctx.copy.progressOverview.analytics.planAnalysis.missed;
  return item.actual.kind === "distance"
    ? ctx.format.distance(item.actual.km, 1)
    : formatMinutesSeconds(item.actual.sec);
}

/** Key workouts of the plan: planned target next to the actual value. */
export function PlanAnalysisBlock({ theme, ctx, analytics }: Props) {
  const t = ctx.copy.progressOverview.analytics;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  if (analytics.planKeyWorkouts.length === 0) return null;

  return (
    <>
      <SectionHeader
        theme={theme}
        title={t.planAnalysis.title}
        aside={<DemoBadge theme={theme} label={t.demo} />}
      />
      <ProgressCard
        theme={theme}
        style={[progressStyles.listBody, styles.listBottom]}
      >
        <View style={[styles.row, styles.headRow]}>
          <View style={styles.flex}>
            <Kicker theme={theme}>{t.planAnalysis.kicker}</Kicker>
          </View>
          <Kicker theme={theme} style={styles.planCol}>
            {t.planAnalysis.planned}
          </Kicker>
          <Kicker theme={theme} style={styles.factCol}>
            {t.planAnalysis.actual}
          </Kicker>
        </View>
        {analytics.planKeyWorkouts.map((item) => {
          const missed = item.actual === null;
          const color = missed ? palette.muted : palette.fg;
          const type = ctx.copy.progressOverview.workouts.types[item.type];
          return (
            <View
              key={`${item.type}-${item.date}`}
              style={[
                styles.row,
                { borderTopWidth: 1, borderTopColor: palette.line },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.flex,
                  styles.title,
                  { color, fontFamily: font.medium },
                ]}
              >
                {missed
                  ? `${type}, ${formatDayMonth(item.date, ctx.language)}`
                  : type}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.planCol,
                  styles.cell,
                  { color: palette.muted, fontFamily: font.regular },
                ]}
              >
                {plannedText(ctx, item)}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.factCol,
                  styles.cell,
                  { color, fontFamily: font.medium },
                ]}
              >
                {actualText(ctx, item)}
              </Text>
            </View>
          );
        })}
      </ProgressCard>
    </>
  );
}

/** Coach observations, each with the data it is based on. */
export function InsightsBlock({
  theme,
  ctx,
  analytics,
  hasHeartRate,
}: Props & { hasHeartRate: boolean }) {
  const t = ctx.copy.progressOverview.analytics;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  if (analytics.insights.length === 0) return null;

  return (
    <>
      <SectionHeader
        theme={theme}
        title={t.insights.title}
        aside={<DemoBadge theme={theme} label={t.demo} />}
      />
      <ProgressCard theme={theme} style={progressStyles.listBody}>
        {analytics.insights.map((insight, index) => {
          const key =
            insight.code === "easy_pace_faster" &&
            insight.usesHeartRate &&
            hasHeartRate
              ? "easy_pace_faster_hr"
              : insight.code;
          return (
            <View
              key={insight.code}
              style={[
                styles.insight,
                index > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: palette.line,
                },
              ]}
            >
              <Sparkles size={18} color={palette.ai} style={styles.icon} />
              <View style={[styles.flex, styles.insightText]}>
                <Text
                  style={[
                    progressStyles.body,
                    { color: palette.fg, fontFamily: font.regular },
                  ]}
                >
                  {fillTemplate(t.insights[key], insight.params)}
                </Text>
                <Caption theme={theme}>
                  {fillTemplate(
                    t.insights[`${insight.code}_basis`],
                    insight.params,
                  )}
                </Caption>
              </View>
            </View>
          );
        })}
      </ProgressCard>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  listBottom: { paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  headRow: { minHeight: 0, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 14, lineHeight: 20 },
  planCol: { width: 76, textAlign: "right" },
  factCol: { width: 64, textAlign: "right" },
  cell: { fontSize: 13, lineHeight: 18 },
  insight: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
  },
  icon: { marginTop: 1 },
  insightText: { gap: 4 },
});
