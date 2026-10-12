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
import { type ThemeTokens, type ThemeMode } from "@trefix/tokens";
import { type DayEvent } from "../../today-types";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "../../../../shared/ui/card";
import { type MainCopy } from "../../../../locales";

type CardProps = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  event: DayEvent;
  onPress?: (event: DayEvent) => void;
  onAction?: (event: DayEvent) => void;
  copy: MainCopy;
};

export const WorkoutCard = React.memo(
  ({ theme, themeMode, event, onPress, onAction, copy }: CardProps) => {
    const statusLabels = copy.today.workout.statuses;
    const actionLabels = copy.today.workout.actions;

    const renderStatusIcon = () => {
      switch (event.status) {
        case "completed":
          return <CheckCircle2 size={16} color={theme.color.primary} />;
        case "missed":
          return <XCircle size={16} color={theme.color.mutedForeground} />;
        case "modified":
          return <Sparkles size={16} color={theme.color.ai} />;
        default:
          return <Activity size={16} color={theme.color.primary} />;
      }
    };

    return (
      <Pressable
        onPress={() => onPress?.(event)}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <Card
          variant="glass"
          theme={theme}
          themeMode={themeMode}
          style={styles.card}
        >
          <CardHeader style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              {renderStatusIcon()}
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                  event.status === "completed" && {
                    color: theme.color.foreground,
                  },
                ]}
              >
                {event.status === "completed" && "✓ "}
                {event.title}
              </Text>
            </View>
            <ChevronRight size={16} color={theme.color.mutedForeground} />
          </CardHeader>

          <CardContent style={styles.cardBody}>
            {event.status === "modified" && (
              <Text
                style={[
                  styles.modifiedLabel,
                  {
                    color: theme.color.ai,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {statusLabels.modified}
              </Text>
            )}

            {event.status === "missed" && (
              <Text
                style={[
                  styles.missedLabel,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {statusLabels.missed}
              </Text>
            )}

            <View style={styles.metricsContainer}>
              {event.distance && (
                <Text
                  style={[
                    styles.metric,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {event.distance}
                </Text>
              )}
              {event.distance && event.duration && (
                <Text style={{ color: theme.color.mutedForeground }}> · </Text>
              )}
              {event.duration && (
                <Text
                  style={[
                    styles.metric,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {event.duration}
                </Text>
              )}
            </View>

            {event.description && (
              <Text
                style={[
                  styles.description,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {event.description}
              </Text>
            )}
          </CardContent>

          <CardFooter style={styles.cardFooter}>
            {event.status === "planned" && (
              <Pressable
                onPress={() => onAction?.(event)}
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.color.primary },
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    {
                      color: theme.color.primaryForeground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {actionLabels.start}
                </Text>
                <ChevronRight size={14} color={theme.color.primaryForeground} />
              </Pressable>
            )}

            {event.status === "completed" && (
              <Text
                style={[
                  styles.footerText,
                  {
                    color: theme.color.primary,
                    fontFamily: theme.typography.fontFamily.sans.semibold,
                  },
                ]}
              >
                {actionLabels.view} →
              </Text>
            )}

            {event.status === "modified" && (
              <Text
                style={[
                  styles.footerText,
                  {
                    color: theme.color.ai,
                    fontFamily: theme.typography.fontFamily.sans.semibold,
                  },
                ]}
              >
                {actionLabels.why} →
              </Text>
            )}
          </CardFooter>
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
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    marginBottom: 8,
    paddingHorizontal: 0,
    paddingTop: 0,
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
    paddingHorizontal: 0,
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
    paddingHorizontal: 0,
    paddingBottom: 0,
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 16,
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
