import { Pressable, StyleSheet, Text, View } from "react-native";
import { SlidersHorizontal, Sparkles } from "lucide-react-native";

import { type PlanAdaptation } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";

type Props = {
  adaptations: PlanAdaptation[];
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onSelectAdaptation: (adaptation: PlanAdaptation) => void;
};

export function RecentAdaptationsCard({
  adaptations,
  theme,
  copy,
  onSelectAdaptation,
}: Props) {
  const planCopy = copy.plan;

  if (adaptations.length === 0) {
    return (
      <Card
        style={[
          styles.card,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <SlidersHorizontal color={theme.color.mutedForeground} size={16} />
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {planCopy.adaptations.sectionTitle}
          </Text>
        </View>
        <Text
          style={[
            styles.onTrackText,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {planCopy.adaptations.onTrack}
        </Text>
      </Card>
    );
  }

  // Format created at (e.g., 2 days ago or raw text)
  const formatTimeAgo = (createdAt: string) => {
    if (
      createdAt.includes(" ago") ||
      createdAt.includes("назад") ||
      createdAt.includes("d ago")
    ) {
      return createdAt;
    }
    const createdDate = new Date(createdAt);
    const now = new Date();
    const diffHours = Math.floor(
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60),
    );
    if (diffHours < 24) {
      return diffHours <= 1
        ? planCopy.adaptations.justNow
        : planCopy.adaptations.hoursAgo.replace("{{hours}}", String(diffHours));
    }
    const diffDays = Math.floor(diffHours / 24);
    return planCopy.adaptations.daysAgo.replace("{{days}}", String(diffDays));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Sparkles color={theme.color.accent} size={16} />
        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {planCopy.adaptations.sectionTitle}
        </Text>
      </View>

      <View style={styles.list}>
        {adaptations.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onSelectAdaptation(item)}
            style={({ pressed }) => [
              styles.adaptationItem,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.itemHeader}>
              <View style={styles.itemTitleRow}>
                <Text
                  style={[
                    styles.itemTitle,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {item.title}
                </Text>
                {item.weekNumber ? (
                  <View
                    style={[
                      styles.weekBadge,
                      {
                        backgroundColor: theme.color.surface,
                        borderColor: theme.color.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekBadgeText,
                        {
                          color: theme.color.mutedForeground,
                          fontFamily: theme.typography.fontFamily.sans.semibold,
                        },
                      ]}
                    >
                      {planCopy.timeline.weekLabel.replace(
                        "{{number}}",
                        String(item.weekNumber),
                      )}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                style={[
                  styles.timeAgoText,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {formatTimeAgo(item.createdAt)}
              </Text>
            </View>

            {item.description ? (
              <Text
                numberOfLines={2}
                style={[
                  styles.itemDescription,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {item.description}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 28,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  onTrackText: {
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: 10,
  },
  adaptationItem: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  weekBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  weekBadgeText: {
    fontSize: 10,
    lineHeight: 14,
  },
  timeAgoText: {
    fontSize: 12,
    lineHeight: 16,
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
