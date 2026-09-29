import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Trophy, Sparkles, X } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressMilestone } from "../types/progress-types";
import type { MainCopy } from "../../../locales";

type Props = {
  milestone: ProgressMilestone | null;
  visible: boolean;
  onClose: () => void;
  onAskTrefix: (milestone: ProgressMilestone) => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

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
    return null;
  }

  const isDark = themeMode === "dark";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.backdrop} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
            },
          ]}
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View
              style={[
                styles.handle,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(0, 0, 0, 0.15)",
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={theme.color.foreground} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
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
                    styles.sectionHeader,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {copy.progress?.milestones?.detailTitle || "MILESTONE DETAILS"}
                </Text>
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
                <Text
                  style={[
                    styles.contextLabel,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {copy.progress?.milestones?.context || "Context"}
                </Text>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "85%",
    paddingBottom: 32,
  },
  topBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 3,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    top: 10,
    padding: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  trophyWrap: {
    padding: 12,
    borderRadius: 16,
  },
  titleWrap: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  milestoneTitle: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
  },
  valueRow: {
    marginBottom: 20,
  },
  primaryValue: {
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.5,
    marginBottom: 2,
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
    marginBottom: 20,
    gap: 16,
  },
  gridCol: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  contextBox: {
    marginBottom: 24,
  },
  contextLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  contextBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 18,
    gap: 8,
    marginTop: 8,
  },
  askButtonText: {
    fontSize: 16,
    lineHeight: 20,
  },
});
