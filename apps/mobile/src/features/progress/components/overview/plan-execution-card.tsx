import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

import { fillTemplate, pluralize } from "../../../../locales";
import {
  type ProgressPeriod,
  type ProgressSnapshot,
} from "../../data/progress-model";
import { planExecutionFor } from "../../lib/progress-selectors";
import {
  planScopeText,
  type ProgressTextContext,
} from "../../lib/progress-text";
import {
  Caption,
  Kicker,
  ProgressCard,
  SectionHeader,
  Track,
  fonts,
  progressPalette,
} from "../progress-ui";

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  snapshot: ProgressSnapshot;
  period: ProgressPeriod;
  onPress: () => void;
};

/** Done vs due workouts of the plan; future workouts are "ahead", never "missed". */
export function PlanExecutionCard({
  theme,
  ctx,
  snapshot,
  period,
  onPress,
}: Props) {
  const view = planExecutionFor(snapshot, period);
  if (!view || !snapshot.plan) return null;
  const t = ctx.copy.progressOverview.plan;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const missed = view.due - view.done;
  const notes: string[] = [];
  if (missed > 0) notes.push(pluralize(t.missed, missed, ctx.language));
  if (view.offPlanKm > 0)
    notes.push(
      fillTemplate(t.offPlan, {
        value: ctx.format.distance(view.offPlanKm, 1),
      }),
    );
  if (view.upcoming > 0)
    notes.push(pluralize(t.upcoming, view.upcoming, ctx.language));
  const percent = view.percent;

  return (
    <>
      <SectionHeader
        theme={theme}
        title={t.title}
        aside={planScopeText(ctx, view, snapshot.asOf, snapshot.plan.startDate)}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ProgressCard theme={theme} style={styles.card}>
          {percent === null ? (
            <Text
              style={[
                styles.count,
                { color: palette.fg, fontFamily: font.medium },
              ]}
            >
              {t.nothingDue}
            </Text>
          ) : (
            <>
              <View style={styles.row}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.count,
                    { color: palette.fg, fontFamily: font.medium },
                  ]}
                >
                  {fillTemplate(ctx.copy.progressOverview.plan.kmValue, {
                    actual: view.done,
                    planned: view.due,
                  })}{" "}
                  <Text
                    style={[
                      styles.unit,
                      { color: palette.muted, fontFamily: font.regular },
                    ]}
                  >
                    {t.workouts}
                  </Text>
                </Text>
                <Text
                  style={[
                    styles.percent,
                    { color: palette.fg, fontFamily: font.medium },
                  ]}
                >{`${percent}%`}</Text>
              </View>
              <Track theme={theme} percent={percent} />
            </>
          )}
          <View style={styles.row}>
            <Kicker theme={theme}>{t.distance}</Kicker>
            <Text
              numberOfLines={1}
              style={[
                styles.km,
                { color: palette.fg, fontFamily: font.medium },
              ]}
            >
              {fillTemplate(t.kmValue, {
                actual: ctx.format
                  .distance(view.actualKm, 1)
                  .replace(/\s\S+$/, ""),
                planned: ctx.format.distance(view.plannedKm, 0),
              })}
            </Text>
          </View>
          {notes.length > 0 ? (
            <Caption theme={theme}>{notes.join(" · ")}</Caption>
          ) : null}
        </ProgressCard>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  count: { flexShrink: 1, fontSize: 22, lineHeight: 28 },
  unit: { fontSize: 15 },
  percent: { fontSize: 17, lineHeight: 22 },
  km: { fontSize: 13, lineHeight: 18 },
});
