import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";
import { formatHoursMinutesSeconds } from "@trefix/utils";

import {
  fillTemplate,
  formatDateLong,
  formatDayMonth,
  pluralize,
} from "../../../../locales";
import {
  type ProgressGoal,
  type ProgressPlan,
} from "../../data/progress-model";
import { daysUntil, type ProgressTextContext } from "../../lib/progress-text";
import { parseYmd } from "../../lib/progress-selectors";
import { Caption, Kicker, Track, fonts, progressPalette } from "../progress-ui";

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  goal: ProgressGoal;
  plan: ProgressPlan;
  asOf: string;
  onPress: () => void;
};

/** Goal of the plan in progress: best confirmed result next to the target. */
export function GoalBlock({ theme, ctx, goal, plan, asOf, onPress }: Props) {
  const t = ctx.copy.progressOverview.goal;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const { year, month, day } = parseYmd(goal.raceDate);
  const days = daysUntil(asOf, goal.raceDate);
  const target = formatHoursMinutesSeconds(goal.targetSec);
  const title = fillTemplate(t.title, {
    distance: ctx.format.distance(
      goal.distanceKm,
      Number.isInteger(goal.distanceKm) ? 0 : 1,
    ),
    time: target,
  });
  const race = pluralize(t.race, Math.max(0, days), ctx.language, {
    date: formatDateLong(new Date(year, month, day), ctx.language),
  });
  const best = goal.best;
  const gap = best ? best.seconds - goal.targetSec : null;
  const gapText =
    gap === null
      ? ""
      : gap > 0
        ? fillTemplate(t.remaining, { value: formatHoursMinutesSeconds(gap) })
        : t.achieved;
  const big = [styles.big, { fontFamily: font.medium }];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.kicker}: ${title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        { borderBottomColor: palette.line },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.kickerRow}>
        <Kicker theme={theme}>{t.kicker}</Kicker>
        <ChevronRight size={16} color={palette.muted} />
      </View>
      <Text
        numberOfLines={1}
        style={[styles.title, { color: palette.fg, fontFamily: font.medium }]}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.sub, { color: palette.muted, fontFamily: font.regular }]}
      >
        {race}
      </Text>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Kicker theme={theme}>{t.best}</Kicker>
          <Text
            numberOfLines={1}
            style={[big, { color: best ? palette.fg : palette.muted }]}
          >
            {best ? formatHoursMinutesSeconds(best.seconds) : t.bestNone}
          </Text>
          <Caption theme={theme} numberOfLines={1}>
            {best ? formatDayMonth(best.date, ctx.language) : t.bestNoneHint}
          </Caption>
        </View>
        <View style={styles.column}>
          <Kicker theme={theme}>{t.target}</Kicker>
          <Text numberOfLines={1} style={[big, { color: palette.muted }]}>
            {target}
          </Text>
          <Caption theme={theme} numberOfLines={1}>
            {gapText}
          </Caption>
        </View>
      </View>

      <View style={styles.program}>
        <View style={styles.programRow}>
          <Kicker theme={theme}>{t.program}</Kicker>
          <Text
            numberOfLines={1}
            style={[
              styles.programValue,
              { color: palette.fg, fontFamily: font.medium },
            ]}
          >
            {fillTemplate(t.programWeek, {
              current: plan.currentWeek,
              total: plan.totalWeeks,
            })}
          </Text>
        </View>
        <Track
          theme={theme}
          percent={(plan.currentWeek / plan.totalWeeks) * 100}
        />
        <Caption theme={theme} numberOfLines={1}>
          {t.programNote}
        </Caption>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 22, borderBottomWidth: 1 },
  pressed: { opacity: 0.7 },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { marginTop: 6, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  sub: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  columns: { flexDirection: "row", gap: 12, marginTop: 18 },
  column: { flex: 1, minWidth: 0, gap: 4 },
  big: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  program: { marginTop: 18, gap: 8 },
  programRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  programValue: { fontSize: 13, lineHeight: 18 },
});
