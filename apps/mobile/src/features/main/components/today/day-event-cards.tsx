import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Check, Moon, X } from "lucide-react-native";
import { type ThemeTokens, type ThemeMode } from "@trefix/tokens";
import { type DayEvent } from "../../today-types";
import { Card } from "../../../../shared/ui/card";
import { IntensityScale } from "../intensity-scale";
import { type MainCopy } from "../../../../locales";

type CardProps = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  event: DayEvent;
  onPress?: (event: DayEvent) => void;
  copy: MainCopy;
};

/** Read-only completion mark: filled check when done, a cross when missed, an empty box otherwise. */
export function StatusBox({
  theme,
  status,
  label,
}: {
  theme: ThemeTokens;
  status: DayEvent["status"];
  label: string;
}) {
  const isCompleted = status === "completed";

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.statusBox,
        isCompleted
          ? { backgroundColor: theme.color.primary }
          : { borderColor: theme.color.controlBorder, borderWidth: 1.5 },
      ]}
    >
      {isCompleted ? (
        <Check
          size={16}
          strokeWidth={2.5}
          color={theme.color.primaryForeground}
        />
      ) : status === "missed" ? (
        <X size={16} strokeWidth={2.5} color={theme.color.mutedForeground} />
      ) : null}
    </View>
  );
}

/** Workout of the day: when, what, how much and how hard. Tapping it opens the details. */
export const WorkoutCard = React.memo(
  ({ theme, themeMode, event, onPress, copy }: CardProps) => {
    const statusLabel =
      copy.today.workout.statuses[event.status] ?? event.status;
    const isMissed = event.status === "missed";
    const level = event.intensity ?? 1;
    const intensityLabel = copy.today.workout.intensity[level];
    const meta = [event.typeLabel, intensityLabel].filter(Boolean).join(" · ");
    const strongColor = isMissed
      ? theme.color.mutedForeground
      : theme.color.foreground;
    const muted = {
      color: theme.color.mutedForeground,
      fontFamily: theme.typography.fontFamily.sans.regular,
    };

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          event.title,
          event.dateLabel,
          event.distance,
          event.duration,
          meta,
          statusLabel,
        ]
          .filter(Boolean)
          .join(", ")}
        onPress={() => onPress?.(event)}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <Card
          theme={theme}
          themeMode={themeMode}
          style={[styles.card, styles.workoutCard]}
        >
          <IntensityScale
            theme={theme}
            level={level}
            size="card"
            dimmed={isMissed}
          />

          <View style={styles.workoutTopRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.workoutKicker,
                muted,
                { fontFamily: theme.typography.fontFamily.sans.medium },
              ]}
            >
              {event.dateLabel}
            </Text>
            <StatusBox
              theme={theme}
              status={event.status}
              label={statusLabel}
            />
          </View>

          <Text
            numberOfLines={2}
            style={[
              styles.workoutTitle,
              {
                color: strongColor,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {event.title}
          </Text>

          <View style={styles.workoutVolume}>
            {event.distance ? (
              <Text
                style={[
                  styles.workoutValue,
                  {
                    color: strongColor,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {event.distance}
              </Text>
            ) : null}
            {event.duration ? (
              <Text style={[styles.workoutDuration, muted]}>
                {event.duration}
              </Text>
            ) : null}
          </View>

          {meta ? (
            <Text numberOfLines={1} style={[styles.workoutMeta, muted]}>
              {meta}
            </Text>
          ) : null}
        </Card>
      </Pressable>
    );
  },
);

export const RecoveryCard = React.memo(
  ({
    theme,
    themeMode,
    copy,
  }: Omit<CardProps, "event"> & { themeMode?: ThemeMode }) => {
    return (
      <Card
        variant="glass"
        theme={theme}
        themeMode={themeMode}
        style={[styles.card, { paddingVertical: 16 }]}
      >
        <View style={styles.titleContainer}>
          <Moon size={16} color={theme.color.mutedForeground} />
          <Text
            style={[
              styles.cardTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.today.recovery.title}
          </Text>
        </View>
        <Text
          style={[
            styles.description,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
              marginTop: 4,
            },
          ]}
        >
          {copy.today.recovery.description}
        </Text>
      </Card>
    );
  },
);

export const EmptyDayCard = React.memo(
  ({ theme, copy }: Omit<CardProps, "themeMode" | "event">) => {
    return (
      <View style={styles.emptyContainer}>
        <Text
          style={[
            styles.emptyText,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {copy.today.noEvents}
        </Text>
      </View>
    );
  },
);

export const DayHeader = React.memo(
  ({
    theme,
    date,
    isToday,
    isTomorrow,
    copy,
  }: {
    theme: ThemeTokens;
    date: string;
    isToday?: boolean;
    isTomorrow?: boolean;
    copy: MainCopy;
  }) => {
    const label = isToday
      ? copy.today.today
      : isTomorrow
        ? copy.today.tomorrow
        : null;

    return (
      <View style={styles.dayHeader}>
        {label && (
          <Text
            style={[
              styles.dayBadge,
              {
                color: theme.color.primary,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {label.toUpperCase()}
          </Text>
        )}
        <Text
          style={[
            styles.dayDate,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {date}
        </Text>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    marginHorizontal: 16,
  },
  workoutCard: {
    paddingTop: 18,
    gap: 0,
  },
  workoutTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  workoutKicker: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  workoutTitle: {
    marginTop: 6,
    maxWidth: 230,
    fontSize: 16,
    lineHeight: 21,
  },
  workoutVolume: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  workoutValue: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  workoutDuration: {
    fontSize: 15,
    lineHeight: 20,
  },
  workoutMeta: {
    marginTop: 6,
    maxWidth: 230,
    fontSize: 13,
    lineHeight: 18,
  },
  statusBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    opacity: 0.8,
  },
  dayHeader: {
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  dayBadge: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 2,
  },
  dayDate: {
    fontSize: 24,
    lineHeight: 30,
  },
});
