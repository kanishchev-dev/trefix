import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Check, Moon, X } from "lucide-react-native";
import { type ThemeTokens, type ThemeMode } from "@trefix/tokens";
import { type DayEvent } from "../../today-types";
import { Card } from "../../../../shared/ui/card";
import { type MainCopy } from "../../../../locales";

type CardProps = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  event: DayEvent;
  onPress?: (event: DayEvent) => void;
  copy: MainCopy;
};

/** Read-only completion mark: filled check when done, a cross when missed, an empty box otherwise. */
function StatusBox({
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

/** Workout of the day: what, when, how much. Tapping it opens the details. */
export const WorkoutCard = React.memo(
  ({ theme, themeMode, event, onPress, copy }: CardProps) => {
    const statusLabel =
      copy.today.workout.statuses[event.status] ?? event.status;
    const isMissed = event.status === "missed";
    const subtitle = [event.dateLabel, event.duration]
      .filter(Boolean)
      .join(" · ");
    const meta = [event.typeLabel, event.distance].filter(Boolean).join(" · ");

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onPress?.(event)}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <Card theme={theme} themeMode={themeMode} style={styles.card}>
          <View style={styles.workoutRow}>
            <View style={styles.workoutText}>
              <Text
                numberOfLines={2}
                style={[
                  styles.workoutTitle,
                  {
                    color: isMissed
                      ? theme.color.mutedForeground
                      : theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {event.title}
              </Text>
              {subtitle ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.workoutSubtitle,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {subtitle}
                </Text>
              ) : null}
              {meta ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.workoutMeta,
                    {
                      color: isMissed
                        ? theme.color.mutedForeground
                        : theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {meta}
                </Text>
              ) : null}
            </View>
            <StatusBox
              theme={theme}
              status={event.status}
              label={statusLabel}
            />
          </View>
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
  workoutRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  workoutText: {
    flex: 1,
    gap: 4,
  },
  workoutTitle: {
    fontSize: 16,
    lineHeight: 21,
  },
  workoutSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  workoutMeta: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 8,
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
