import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Trophy, Sparkles } from "lucide-react-native";
import type { ThemeMode, ThemeTokens } from "@workspace/tokens";
import type { ProgressMilestone } from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { BottomSheet, SheetSectionLabel } from "../../../shared/ui/bottom-sheet";

type Props = {
  milestone: ProgressMilestone | null;
  visible: boolean;
  onClose: () => void;
  onAskTrefix: (milestone: ProgressMilestone) => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/**
 * Milestone details rendered in the canonical app-wide bottom sheet
 * (shared BottomSheet shell extracted from the workout goal sheet).
 */
export function MilestoneDetailSheet({
  milestone,
  visible,
  onClose,
  onAskTrefix,
  theme,
  themeMode,
  copy,
}: Props) {
  if (!milestone) {
    return (
      <BottomSheet visible={false} onClose={onClose} theme={theme} themeMode={themeMode} />
    );
  }

  const isDark = themeMode === "dark";

  return (
    <BottomSheet
      title={copy.progress?.milestones?.detailTitle || "MILESTONE DETAILS"}
      visible={visible}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Trophy Icon & Header */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.trophyWrap,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            ]}
          >
            <Trophy size={24} color={theme.color.foreground} strokeWidth={2} />
          </View>
          <View style={styles.titleWrap}>
            <Text
              style={[
                styles.milestoneTitle,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.extrabold,
                },
              ]}
            >
              {milestone.title}
            </Text>
          </View>
        </View>

        {/* Main Milestone Value */}
        <View style={styles.valueRow}>
          <Text
            style={[
              styles.primaryValue,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.extrabold,
              },
            ]}
          >
            {milestone.value}
          </Text>
          <Text
            style={[
              styles.dateText,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {milestone.date}
          </Text>
        </View>

        {/* Comparison Grid: Previous Best & Improvement */}
        <View
          style={[
            styles.comparisonGrid,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.04)"
                : "rgba(0, 0, 0, 0.03)",
              borderColor: theme.color.border,
            },
          ]}
        >
          {milestone.previousBest ? (
            <View style={styles.gridCol}>
              <Text
                style={[
                  styles.gridLabel,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.progress?.milestones?.previousBest || "Previous best"}
              </Text>
              <Text
                style={[
                  styles.gridValue,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.bold,
                  },
                ]}
              >
                {milestone.previousBest}
              </Text>
            </View>
          ) : null}

          {milestone.change ? (
            <View style={styles.gridCol}>
              <Text
                style={[
                  styles.gridLabel,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.progress?.milestones?.improvedBy || "You improved by"}
              </Text>
              <Text
                style={[
                  styles.gridValue,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.extrabold,
                  },
                ]}
              >
                {milestone.change}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Context from Training Engine */}
        {milestone.context ? (
          <View style={styles.contextBox}>
            <SheetSectionLabel
              text={copy.progress?.milestones?.context || "Context"}
              theme={theme}
            />
            <Text
              style={[
                styles.contextBody,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {milestone.context}
            </Text>
          </View>
        ) : null}

        {/* Ask Trefix Action Button */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onClose();
            onAskTrefix(milestone);
          }}
          style={({ pressed }) => [
            styles.askButton,
            {
              backgroundColor: theme.color.foreground,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Sparkles size={18} color={theme.color.primaryForeground} strokeWidth={2} />
          <Text
            style={[
              styles.askButtonText,
              {
                color: theme.color.primaryForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {copy.progress?.askTrefix || "Ask Trefix"}
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexShrink: 1,
    width: "100%",
  },
  content: {
    gap: 16,
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trophyWrap: {
    padding: 12,
    borderRadius: 16,
  },
  titleWrap: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
  },
  valueRow: {},
  primaryValue: {
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.5,
  },
  dateText: {
    fontSize: 14,
    lineHeight: 18,
  },
  comparisonGrid: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  gridCol: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  gridValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  contextBox: {},
  contextBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
  },
  askButtonText: {
    fontSize: 16,
    lineHeight: 20,
  },
});
