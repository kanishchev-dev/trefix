import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Sparkles,
  Moon,
  ChevronRight,
} from "lucide-react-native";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";
import { type DayEvent } from "../../today-types";

type CardProps = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  event: DayEvent;
  onPress?: (event: DayEvent) => void;
  onAction?: (event: DayEvent) => void;
  copy: any;
};

export const WorkoutCard = React.memo(({ theme, themeMode, event, onPress, onAction, copy }: CardProps) => {
  const isDark = themeMode === "dark";
  const statusLabels = copy.today.workout.statuses;
  const actionLabels = copy.today.workout.actions;

  const renderStatusIcon = () => {
    switch (event.status) {
      case "completed":
        return <CheckCircle2 size={16} color={theme.color.primary} />;
      case "missed":
        return <XCircle size={16} color={theme.color.mutedForeground} />;
      case "modified":
        return <Sparkles size={16} color="#A37EFF" />;
      default:
        return <Activity size={16} color={theme.color.primary} />;
    }
  };

  return (
    <Pressable
      onPress={() => onPress?.(event)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
        },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          {renderStatusIcon()}
          <Text
            style={[
              styles.cardTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
              event.status === "completed" && { color: theme.color.foreground },
            ]}
          >
            {event.status === "completed" && "✓ "}
            {event.title}
          </Text>
        </View>
        <ChevronRight size={16} color={theme.color.mutedForeground} />
      </View>

      <View style={styles.cardBody}>
        {event.status === "modified" && (
          <Text style={[styles.modifiedLabel, { color: "#A37EFF", fontFamily: theme.typography.fontFamily.sans.medium }]}>
            {statusLabels.modified}
          </Text>
        )}

        {event.status === "missed" && (
          <Text style={[styles.missedLabel, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
            {statusLabels.missed}
          </Text>
        )}

        <View style={styles.metricsContainer}>
          {event.distance && (
            <Text style={[styles.metric, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.semibold }]}>
              {event.distance}
            </Text>
          )}
          {event.distance && event.duration && <Text style={{ color: theme.color.mutedForeground }}> · </Text>}
          {event.duration && (
            <Text style={[styles.metric, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
              {event.duration}
            </Text>
          )}
        </View>

        {event.description && (
          <Text style={[styles.description, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
            {event.description}
          </Text>
        )}
      </View>

      <View style={styles.cardFooter}>
        {event.status === "planned" && (
          <Pressable
            onPress={() => onAction?.(event)}
            style={[styles.actionButton, { backgroundColor: theme.color.primary }]}
          >
            <Text style={[styles.actionButtonText, { color: theme.color.primaryForeground, fontFamily: theme.typography.fontFamily.sans.semibold }]}>
              {actionLabels.start}
            </Text>
            <ChevronRight size={14} color={theme.color.primaryForeground} />
          </Pressable>
        )}

        {event.status === "completed" && (
          <Text style={[styles.footerText, { color: theme.color.primary, fontFamily: theme.typography.fontFamily.sans.semibold }]}>
            {actionLabels.view} →
          </Text>
        )}

        {event.status === "modified" && (
          <Text style={[styles.footerText, { color: "#A37EFF", fontFamily: theme.typography.fontFamily.sans.semibold }]}>
            {actionLabels.why} →
          </Text>
        )}
      </View>
    </Pressable>
  );
});

export const RecoveryCard = React.memo(({ theme, copy }: Omit<CardProps, "themeMode" | "event">) => {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          paddingVertical: 16,
        },
      ]}
    >
      <View style={styles.titleContainer}>
        <Moon size={16} color={theme.color.mutedForeground} />
        <Text
          style={[
            styles.cardTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.bold,
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
    </View>
  );
});

export const EmptyDayCard = React.memo(({ theme, copy }: Omit<CardProps, "themeMode" | "event">) => {
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
});

export const DayHeader = React.memo(({ theme, date, isToday, isTomorrow, copy }: {
  theme: ThemeTokens;
  date: string;
  isToday?: boolean;
  isTomorrow?: boolean;
  copy: any;
}) => {
  const label = isToday ? copy.today.today : isTomorrow ? copy.today.tomorrow : null;

  return (
    <View style={styles.dayHeader}>
      {label && (
        <Text
          style={[
            styles.dayBadge,
            {
              color: theme.color.primary,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
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
            fontFamily: theme.typography.fontFamily.sans.bold,
          },
        ]}
      >
        {date}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
  },
  cardBody: {
    marginBottom: 12,
  },
  modifiedLabel: {
    fontSize: 13,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  missedLabel: {
    fontSize: 13,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  metricsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  metric: {
    fontSize: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
  },
  footerText: {
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.7,
  },
  dayHeader: {
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 24,
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
