import { Pressable, StyleSheet, Text, View } from "react-native";
import { Trophy, ChevronRight } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressMilestone } from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";

type Props = {
  milestone: ProgressMilestone;
  onPress: () => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function MilestoneCard({ milestone, onPress, theme, themeMode }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Card
        variant="glass"
        theme={theme}
        style={styles.card}
      >
        <View style={styles.leftCol}>
          <View style={styles.iconWrap}>
            <Trophy size={16} color={theme.color.foreground} strokeWidth={2} />
          </View>
          <View style={styles.textWrap}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {milestone.title}
            </Text>
            <Text
              style={[
                styles.date,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {milestone.date}
            </Text>
          </View>
        </View>

        <View style={styles.rightCol}>
          <Text
            style={[
              styles.value,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.extrabold,
              },
            ]}
          >
            {milestone.value}
          </Text>
          <ChevronRight size={16} color={theme.color.mutedForeground} strokeWidth={2} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  leftCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    lineHeight: 15,
  },
  rightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  value: {
    fontSize: 18,
    lineHeight: 22,
  },
});
