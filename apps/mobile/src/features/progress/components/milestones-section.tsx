import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressMilestone } from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { MilestoneCard } from "./milestone-card";

type Props = {
  milestones: ProgressMilestone[];
  onSelectMilestone: (milestone: ProgressMilestone) => void;
  onViewAll: () => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function MilestonesSection({
  milestones,
  onSelectMilestone,
  onViewAll,
  theme,
  themeMode,
  copy,
}: Props) {
  if (!milestones || milestones.length === 0) {
    return null;
  }

  // Show top 3-4 on main view
  const topMilestones = milestones.slice(0, 4);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.bold,
            },
          ]}
        >
          {copy.progress?.milestones?.sectionTitle || "MILESTONES"}
        </Text>

        {milestones.length > 3 ? (
          <Pressable accessibilityRole="button" onPress={onViewAll}>
            <Text
              style={[
                styles.viewAllText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {copy.progress?.milestones?.viewAll || "View all"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View>
        {topMilestones.map((m) => (
          <MilestoneCard
            key={m.id}
            copy={copy}
            milestone={m}
            onPress={() => onSelectMilestone(m)}
            theme={theme}
            themeMode={themeMode}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  viewAllText: {
    fontSize: 13,
    lineHeight: 16,
  },
});
