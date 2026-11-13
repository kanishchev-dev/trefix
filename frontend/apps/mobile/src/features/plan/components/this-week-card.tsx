import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { workoutTypeLabel } from "../../plans/lib/plan-texts";
import { type PlanWeekStats, type WeekDay } from "../lib/active-plan-view";
import { distanceNumber, distancePair } from "../lib/distance-text";

type Props = {
  week: PlanWeekStats;
  days: WeekDay[];
  /** "Темповая 8 км" labels of the quality sessions. */
  keySessions: string[];
  theme: ThemeTokens;
  copy: MainCopy;
  language: AppLanguage;
  onPress: () => void;
};

/** Current week by day, like the Today calendar: done, missed, today, planned, rest. */
export function ThisWeekCard({
  week,
  days,
  keySessions,
  theme,
  copy,
  language,
  onPress,
}: Props) {
  const t = copy.plan.screen;
  const format = useUnitFormat(copy, language);
  const dayNames = shortDayNamesFor(language);
  const progress =
    week.plannedKm > 0 ? Math.min(1, week.actualKm / week.plannedKm) : 0;
  const medium = theme.typography.fontFamily.sans.medium;
  const regular = theme.typography.fontFamily.sans.regular;

  const caption = (day: WeekDay): string => {
    if (day.isToday) return t.thisWeek.today;
    if (day.kind === "rest") return t.thisWeek.rest;
    if (day.kind === "done") return format.distance(day.km, 0);
    return day.type ? workoutTypeLabel(day.type, copy) : "";
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t.thisWeek.openWeek}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.color.card },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[
            styles.kicker,
            { color: theme.color.mutedForeground, fontFamily: medium },
          ]}
        >
          {fillTemplate(t.thisWeek.kicker, { phase: t.phaseNames[week.phase] })}
        </Text>
        <Text
          style={[
            styles.volume,
            { color: theme.color.foreground, fontFamily: medium },
          ]}
        >
          {distancePair(week.actualKm, week.plannedKm, format)}
        </Text>
      </View>

      <View style={styles.days}>
        {days.map((day) => {
          const label = dayNames[day.weekday] ?? "";
          const isPlanned = day.kind === "planned";
          return (
            <View
              key={day.date}
              accessible
              accessibilityLabel={fillTemplate(t.thisWeek.a11yDay, {
                day: label,
                state: [
                  caption(day),
                  isPlanned ? format.distance(day.km, 0) : "",
                ]
                  .filter(Boolean)
                  .join(", "),
              })}
              style={styles.day}
            >
              <Text
                style={[
                  styles.dayName,
                  {
                    color: day.isToday
                      ? theme.color.foreground
                      : theme.color.mutedForeground,
                    fontFamily: medium,
                  },
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.circle,
                  day.kind === "done"
                    ? { backgroundColor: theme.color.primary }
                    : day.kind === "rest"
                      ? null
                      : day.isToday
                        ? {
                            borderWidth: 2,
                            borderColor: theme.color.foreground,
                          }
                        : {
                            borderWidth: 1.5,
                            borderColor: theme.color.controlBorder,
                          },
                ]}
              >
                {day.kind === "done" ? (
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    color={theme.color.primaryForeground}
                  />
                ) : day.kind === "missed" ? (
                  <X
                    size={16}
                    strokeWidth={2.5}
                    color={theme.color.mutedForeground}
                  />
                ) : (
                  <Text
                    style={[
                      styles.circleText,
                      {
                        color: isPlanned
                          ? theme.color.foreground
                          : theme.color.intensity1,
                        fontFamily: medium,
                      },
                    ]}
                  >
                    {isPlanned ? distanceNumber(day.km, format) : "—"}
                  </Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.caption,
                  day.isToday
                    ? { color: theme.color.foreground, fontFamily: medium }
                    : {
                        color: theme.color.mutedForeground,
                        fontFamily: regular,
                      },
                ]}
              >
                {caption(day)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.track, { backgroundColor: theme.color.secondary }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: theme.color.primary,
            },
          ]}
        />
      </View>

      {keySessions.length > 0 ? (
        <Text
          style={[
            styles.note,
            { color: theme.color.mutedForeground, fontFamily: regular },
          ]}
        >
          {fillTemplate(t.thisWeek.keySessions, {
            list: keySessions.join(", "),
          })}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  volume: {
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  days: {
    marginTop: 12,
    flexDirection: "row",
  },
  day: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 4,
  },
  dayName: {
    fontSize: 11,
    lineHeight: 14,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: {
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  caption: {
    fontSize: 10,
    lineHeight: 12,
    maxWidth: "100%",
  },
  track: {
    marginTop: 14,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  note: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
});
