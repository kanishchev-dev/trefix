import { Pressable, StyleSheet, Text, View } from "react-native";
import { Footprints } from "lucide-react-native";

import { type Gear } from "@trefix/api-client";
import { type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  formatDayMonth,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { IconCircle, Pill, SourceBadge } from "../../../shared/ui/list-card";
import { gearName, type Formatter } from "../lib/profile-format";

type Props = {
  gear: Gear;
  copy: MainCopy;
  language: AppLanguage;
  format: Formatter;
  theme: ThemeTokens;
  onPress: () => void;
  onLongPress?: () => void;
};

/** A pair of shoes: name, wear bar, mileage against the limit and default workout types. */
export function GearCard({
  gear,
  copy,
  language,
  format,
  theme,
  onPress,
  onLongPress,
}: Props) {
  const g = copy.profile.gear;
  const types = gear.defaultWorkoutTypes
    .map(
      (type) =>
        copy.profile.workoutTypes[
          type as keyof MainCopy["profile"]["workoutTypes"]
        ] ?? type,
    )
    .join(" · ");
  const meta = [
    gear.nickname,
    gear.startedAt
      ? fillTemplate(g.since, {
          date: formatDayMonth(gear.startedAt, language),
        })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const barColor = gear.replaceSoon
    ? theme.color.warning
    : theme.color.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${gearName(gear)}, ${format.distance(gear.distanceKm, 0)}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.color.card },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.head}>
        <IconCircle theme={theme}>
          <Footprints color={theme.color.foreground} size={20} />
        </IconCircle>
        <View style={styles.titles}>
          <View style={styles.titleRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.title,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {gearName(gear)}
            </Text>
            {gear.source === "strava" ? <SourceBadge theme={theme} /> : null}
          </View>
          {meta ? (
            <Text
              numberOfLines={1}
              style={[
                styles.meta,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {meta}
            </Text>
          ) : null}
        </View>
        {gear.replaceSoon ? (
          <Pill theme={theme} text={g.replaceSoon} tone="warning" />
        ) : null}
      </View>

      <View
        style={[styles.track, { backgroundColor: theme.color.iconSurface }]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, gear.wearPercent)}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      <View style={styles.statsRow}>
        <Text
          numberOfLines={1}
          style={[
            styles.stats,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {fillTemplate(g.stats, {
            distance: format.distance(gear.distanceKm, 0),
            count: gear.workoutsCount,
          })}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.stats,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {fillTemplate(g.limit, { limit: format.distance(gear.limitKm, 0) })}
        </Text>
      </View>

      {types ? (
        <Text
          numberOfLines={1}
          style={[
            styles.meta,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {types}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titles: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  stats: {
    fontSize: 13,
    lineHeight: 18,
  },
});
