import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type PlanGoal } from "@trefix/api-client";
import { type ThemeTokens } from "@trefix/tokens";
import { formatHoursMinutesSeconds } from "@trefix/utils";

import {
  fillTemplate,
  formatDateLong,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import {
  daysBetween,
  parseIsoDate,
  planEndDate,
  todayIso,
} from "../../plans/lib/plan-dates";
import {
  loadLandscape,
  phaseGroups,
  type PlanWeekStats,
  type WeekProgress,
} from "../lib/active-plan-view";

/** Same offset SectionLayout leaves for the floating header. */
const HEADER_OFFSET = 78;
const BAR_MIN = 18;
const BAR_RANGE = 46;

type Props = {
  /** "Текущий план · неделя 5 из 12", "Черновик · 12 недель", … */
  kicker: string;
  title: string;
  goal: PlanGoal;
  /** Plan start, for the end date line of a plan without a race. */
  startDate?: string | null;
  totalWeeks: number;
  /** Count days to the race (plan in progress) or just name its date. */
  countdown?: boolean;
  /** Extra muted line under the date: schedule, result. */
  note?: string | null;
  weeks: PlanWeekStats[];
  theme: ThemeTokens;
  copy: MainCopy;
  language: AppLanguage;
};

/**
 * Open top block of a plan, like the workout screen: where the plan is, the
 * goal, the race date and the weekly volume as a landscape.
 */
export function PlanHero({
  kicker,
  title,
  goal,
  startDate,
  totalWeeks,
  countdown = true,
  note,
  weeks,
  theme,
  copy,
  language,
}: Props) {
  const insets = useSafeAreaInsets();
  const format = useUnitFormat(copy, language);
  const t = copy.plan.screen;
  const target = goal.target;
  const headerSpace = insets.top + HEADER_OFFSET;

  const distanceKm = target?.distanceMeters
    ? target.distanceMeters / 1000
    : null;
  const distanceText =
    distanceKm !== null
      ? format.distance(distanceKm, Number.isInteger(distanceKm) ? 0 : 1)
      : null;
  const value = target?.finishTimeSec
    ? formatHoursMinutesSeconds(target.finishTimeSec)
    : distanceText;
  const secondary = target?.finishTimeSec ? distanceText : null;

  const raceDate = goal.targetDate?.slice(0, 10) ?? null;
  let dateLine: string | null = null;
  if (raceDate) {
    const days = daysBetween(todayIso(), raceDate);
    const date = formatDateLong(parseIsoDate(raceDate), language);
    if (!countdown) dateLine = fillTemplate(t.hero.raceOn, { date });
    else if (days > 0)
      dateLine = pluralize(t.hero.startIn, days, language, { date });
    else if (days === 0) dateLine = fillTemplate(t.hero.startToday, { date });
  } else if (startDate && countdown) {
    dateLine = fillTemplate(t.hero.planEnd, {
      date: formatDateLong(
        parseIsoDate(planEndDate(startDate.slice(0, 10), totalWeeks)),
        language,
      ),
    });
  }

  // A plan not started yet shows its whole shape; otherwise the done part is dark.
  const allAhead = weeks.every((week) => week.status === "upcoming");
  const barColor: Record<WeekProgress, string> = {
    completed: theme.color.intensity3,
    current: theme.color.intensity2,
    upcoming: allAhead ? theme.color.intensity2 : theme.color.separator,
  };
  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const strong = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };

  return (
    <View
      style={[
        styles.hero,
        {
          marginTop: -headerSpace,
          paddingTop: headerSpace + 8,
          backgroundColor: theme.color.card,
          borderBottomColor: theme.color.cardBorder,
        },
      ]}
    >
      <Text style={[styles.kicker, muted, { fontFamily: strong.fontFamily }]}>
        {kicker}
      </Text>
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={[styles.title, strong]}
      >
        {title}
      </Text>
      {value ? (
        <View style={styles.volume}>
          <Text style={[styles.value, strong]}>{value}</Text>
          {secondary ? (
            <Text style={[styles.secondary, muted]}>{secondary}</Text>
          ) : null}
        </View>
      ) : null}
      {dateLine ? <Text style={[styles.date, muted]}>{dateLine}</Text> : null}
      {note ? (
        <Text numberOfLines={1} style={[styles.note, muted]}>
          {note}
        </Text>
      ) : null}

      {weeks.length > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.landscape}>
            {loadLandscape(weeks).map((bar) => (
              <View
                key={bar.weekNumber}
                style={[
                  styles.bar,
                  {
                    height: BAR_MIN + bar.ratio * BAR_RANGE,
                    backgroundColor: barColor[bar.status],
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.axis}>
            {phaseGroups(weeks).map((group) => {
              const isCurrent = group.state === "current";
              return (
                <View
                  key={group.from}
                  style={[
                    styles.axisItem,
                    {
                      flex: group.weeks.length,
                      borderTopColor: isCurrent
                        ? theme.color.foreground
                        : theme.color.separator,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.axisLabel,
                      {
                        color: isCurrent
                          ? theme.color.foreground
                          : theme.color.mutedForeground,
                        fontFamily: strong.fontFamily,
                      },
                    ]}
                  >
                    {t.phaseNames[group.phase]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  kicker: {
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    marginTop: 8,
    maxWidth: 280,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  volume: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  value: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  secondary: {
    fontSize: 17,
    lineHeight: 22,
  },
  note: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  date: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  landscape: {
    marginTop: 22,
    height: BAR_MIN + BAR_RANGE,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: 4,
    marginRight: 6,
    transform: [{ skewX: "-24deg" }],
  },
  bar: {
    flex: 1,
    borderRadius: 3,
  },
  axis: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
  },
  axisItem: {
    minWidth: 0,
    borderTopWidth: 1,
    paddingTop: 5,
  },
  axisLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
});
