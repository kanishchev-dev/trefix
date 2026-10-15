import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, ChevronRight, X } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { IntensityMeter } from "../../main/components/intensity-scale";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { workoutTypeLabel } from "../../plans/lib/plan-texts";
import {
  weekIntensity,
  type PhaseGroup,
  type PlanWeekStats,
} from "../lib/active-plan-view";
import { distanceNumber } from "../lib/distance-text";

/* Fixed geometry, so the rail can be drawn through the node centres. */
const PAD_TOP = 14;
const HEADER = 18;
const HEADER_GAP = 4;
const ROW = 56;
const HEADER_CENTER = PAD_TOP + HEADER / 2;
const rowCenter = (index: number) =>
  PAD_TOP + HEADER + HEADER_GAP + index * ROW + ROW / 2;

type Props = {
  groups: PhaseGroup[];
  /** Finish of the rail: "Цель · 1:45:00" and its subtitle. */
  goal: { title: string; subtitle: string | null };
  theme: ThemeTokens;
  copy: MainCopy;
  language: AppLanguage;
  onSelectWeek: (weekNumber: number) => void;
  onPressGoal?: () => void;
};

/**
 * Weeks grouped by phase. One rail runs through all cards: dots for weeks,
 * rings for phases, a target at the finish. Done part dark, the rest light.
 */
export function PlanPhaseWeeks({
  groups,
  goal,
  theme,
  copy,
  language,
  onSelectWeek,
  onPressGoal,
}: Props) {
  const t = copy.plan.screen.weeks;
  const names = copy.plan.screen.phaseNames;
  const format = useUnitFormat(copy, language);
  const medium = theme.typography.fontFamily.sans.medium;
  const regular = theme.typography.fontFamily.sans.regular;
  const dark = theme.color.foreground;
  const light = theme.color.separator;

  const subtitle = (week: PlanWeekStats): string => {
    const workouts = pluralize(t.workouts, week.workouts, language);
    if (week.status === "completed") {
      return `${workouts} · ${
        week.missed > 0 ? pluralize(t.missed, week.missed, language) : t.allDone
      }`;
    }
    const keys = week.keyTypes.map((type) => workoutTypeLabel(type, copy));
    return keys.length > 0 ? `${workouts} · ${keys.join(", ")}` : workouts;
  };

  const renderNode = (week: PlanWeekStats) =>
    week.status === "completed" ? (
      <View style={[styles.dot, { backgroundColor: dark }]} />
    ) : week.status === "current" ? (
      <View
        style={[
          styles.currentDot,
          { borderColor: dark, backgroundColor: theme.color.card },
        ]}
      />
    ) : (
      <View
        style={[
          styles.dot,
          styles.upcomingDot,
          {
            borderColor: theme.color.intensity1,
            backgroundColor: theme.color.card,
          },
        ]}
      />
    );

  const renderFacts = (week: PlanWeekStats) => {
    const showFact = week.status !== "upcoming";
    const missed = week.status === "completed" && week.missed > 0;
    return (
      <View style={styles.facts}>
        {showFact ? (
          <Text
            style={[
              styles.fact,
              {
                color: missed ? theme.color.mutedForeground : dark,
                fontFamily: medium,
              },
            ]}
          >
            {`${distanceNumber(week.actualKm, format)} / ${distanceNumber(week.plannedKm, format)}`}
          </Text>
        ) : null}
        {week.status === "completed" ? (
          missed ? (
            <X
              size={16}
              strokeWidth={2.5}
              color={theme.color.mutedForeground}
            />
          ) : (
            <Check size={16} strokeWidth={2.5} color={dark} />
          )
        ) : (
          <IntensityMeter theme={theme} level={weekIntensity(week)} />
        )}
        <ChevronRight size={16} color={theme.color.mutedForeground} />
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Text style={[styles.sectionTitle, { color: dark, fontFamily: medium }]}>
        {t.title}
      </Text>
      {groups.map((group, groupIndex) => {
        const isLast = groupIndex === groups.length - 1;
        const rows = group.weeks.length + (isLast ? 1 : 0);
        const railEnd = isLast ? rowCenter(group.weeks.length) : null;
        const currentIndex = group.weeks.findIndex(
          (week) => week.status === "current",
        );
        const lastDone = group.weeks.reduce(
          (found, week, index) => (week.status === "completed" ? index : found),
          -1,
        );
        // The first card starts the rail at its phase ring; the others continue it from the gap above.
        const railStart = groupIndex === 0 ? HEADER_CENTER : 0;
        const darkEnd =
          group.state === "done"
            ? railEnd
            : group.state === "current"
              ? Math.max(
                  HEADER_CENTER,
                  rowCenter(currentIndex >= 0 ? currentIndex : lastDone),
                )
              : railStart;
        const next = groups[groupIndex + 1];
        const phaseColor =
          group.state === "upcoming" ? theme.color.intensity1 : dark;
        const range =
          group.from === group.to
            ? fillTemplate(t.phaseSingle, {
                phase: names[group.phase],
                number: group.from,
              })
            : fillTemplate(t.phaseRange, {
                phase: names[group.phase],
                from: group.from,
                to: group.to,
              });

        return (
          <Fragment key={group.from}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.color.card,
                  minHeight: rowCenter(rows - 1) + ROW / 2 + 6,
                },
              ]}
            >
              {/* Rail: dark up to the current week, light after it. */}
              {darkEnd === null || darkEnd > railStart ? (
                <View
                  style={[
                    styles.rail,
                    darkEnd === null
                      ? { top: railStart, bottom: 0 }
                      : { top: railStart, height: darkEnd - railStart },
                    { backgroundColor: dark },
                  ]}
                />
              ) : null}
              {darkEnd !== null && (railEnd === null || darkEnd < railEnd) ? (
                <View
                  style={[
                    styles.rail,
                    railEnd === null
                      ? { top: darkEnd, bottom: 0 }
                      : { top: darkEnd, height: railEnd - darkEnd },
                    { backgroundColor: light },
                  ]}
                />
              ) : null}

              <View style={styles.phaseRow}>
                <View style={styles.node}>
                  <View
                    style={[
                      styles.phaseRing,
                      {
                        borderColor: phaseColor,
                        backgroundColor: theme.color.card,
                      },
                    ]}
                  >
                    <View
                      style={[styles.phaseDot, { backgroundColor: phaseColor }]}
                    />
                  </View>
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.kicker,
                    styles.flex,
                    { color: theme.color.mutedForeground, fontFamily: medium },
                  ]}
                >
                  {range}
                </Text>
                <Text
                  style={[
                    styles.kicker,
                    { color: theme.color.mutedForeground, fontFamily: medium },
                  ]}
                >
                  {format.distance(group.plannedKm, 0)}
                </Text>
              </View>

              <View style={styles.rows}>
                {group.weeks.map((week) => {
                  const title = fillTemplate(t.weekTitle, {
                    number: week.weekNumber,
                    distance: format.distance(week.plannedKm, 0),
                  });
                  const sub = subtitle(week);
                  return (
                    <Pressable
                      key={week.weekNumber}
                      accessibilityRole="button"
                      accessibilityLabel={`${title}. ${sub}`}
                      onPress={() => onSelectWeek(week.weekNumber)}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.node}>{renderNode(week)}</View>
                      <View style={styles.flex}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.rowTitle,
                            { color: dark, fontFamily: medium },
                          ]}
                        >
                          {title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.rowSub,
                            {
                              color: theme.color.mutedForeground,
                              fontFamily: regular,
                            },
                          ]}
                        >
                          {sub}
                        </Text>
                      </View>
                      {renderFacts(week)}
                    </Pressable>
                  );
                })}

                {isLast ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={[goal.title, goal.subtitle]
                      .filter(Boolean)
                      .join(". ")}
                    disabled={!onPressGoal}
                    onPress={onPressGoal}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.node}>
                      <View
                        style={[
                          styles.target,
                          {
                            borderColor: dark,
                            backgroundColor: theme.color.card,
                          },
                        ]}
                      >
                        <View
                          style={[styles.targetDot, { backgroundColor: dark }]}
                        />
                      </View>
                    </View>
                    <View style={styles.flex}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.rowTitle,
                          { color: dark, fontFamily: medium },
                        ]}
                      >
                        {goal.title}
                      </Text>
                      {goal.subtitle ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.rowSub,
                            {
                              color: theme.color.mutedForeground,
                              fontFamily: regular,
                            },
                          ]}
                        >
                          {goal.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {onPressGoal ? (
                      <ChevronRight
                        size={16}
                        color={theme.color.mutedForeground}
                      />
                    ) : null}
                  </Pressable>
                ) : null}
              </View>
            </View>

            {next ? (
              <View style={styles.connector}>
                <View
                  style={[
                    styles.connectorLine,
                    next.state === "upcoming"
                      ? {
                          backgroundColor: theme.color.intensity1,
                          opacity: 0.45,
                        }
                      : { backgroundColor: dark, opacity: 0.35 },
                  ]}
                />
              </View>
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    paddingTop: PAD_TOP,
    paddingHorizontal: 18,
    paddingBottom: 6,
    overflow: "hidden",
  },
  rail: {
    position: "absolute",
    left: 31,
    width: 2,
    borderRadius: 1,
  },
  phaseRow: {
    height: HEADER,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  node: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kicker: {
    fontSize: 13,
    lineHeight: 18,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  rows: {
    marginTop: HEADER_GAP,
  },
  row: {
    height: ROW,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pressed: {
    opacity: 0.6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  upcomingDot: {
    borderWidth: 2,
  },
  currentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  target: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  targetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  rowSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  facts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fact: {
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  connector: {
    height: 12,
    marginHorizontal: 16,
  },
  connectorLine: {
    position: "absolute",
    left: 31,
    top: 0,
    bottom: 0,
    width: 2,
  },
});
