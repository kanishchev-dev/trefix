import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Clock, Sparkles, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type PlanAdaptation } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";

type Props = {
  adaptation: PlanAdaptation | null;
  visible: boolean;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

export function PlanAdaptationDetailsSheet({
  adaptation,
  visible,
  onClose,
  theme,
  themeMode,
  copy,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!adaptation) return null;

  const planCopy = copy.plan;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={themeMode} />
        </Pressable>

        <View style={styles.container}>
          <View
            style={[
              styles.card,
              {
                borderColor: theme.color.border,
                backgroundColor: theme.color.surfaceElevated,
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
          >
            {/* Handle Bar */}
            <View style={styles.handleContainer}>
              <View
                style={[styles.handle, { backgroundColor: theme.color.border }]}
              />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Sparkles color={theme.color.accent} size={20} />
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {adaptation.title}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={onClose}
                style={styles.closeButton}
              >
                <X color={theme.color.mutedForeground} size={20} />
              </Pressable>
            </View>

            {/* What Changed / Description */}
            {adaptation.description ? (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {planCopy.adaptationDetails.whatChanged.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.bodyText,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {adaptation.description}
                </Text>
              </View>
            ) : null}

            {/* Meta Row: Affected Week & Timestamp */}
            <View style={styles.metaSection}>
              {adaptation.weekNumber ? (
                <View
                  style={[
                    styles.metaBox,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.metaLabel,
                      {
                        color: theme.color.mutedForeground,
                        fontFamily: theme.typography.fontFamily.sans.medium,
                      },
                    ]}
                  >
                    {planCopy.adaptationDetails.affectedWeek}
                  </Text>
                  <Text
                    style={[
                      styles.metaValue,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.bold,
                      },
                    ]}
                  >
                    {planCopy.timeline.weekLabel.replace(
                      "{{number}}",
                      String(adaptation.weekNumber),
                    )}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.metaBox,
                  {
                    backgroundColor: theme.color.surface,
                    borderColor: theme.color.border,
                  },
                ]}
              >
                <Clock color={theme.color.mutedForeground} size={14} />
                <Text
                  style={[
                    styles.metaLabel,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {adaptation.createdAt}
                </Text>
              </View>
            </View>

            {/* Close Button */}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.doneButton,
                { backgroundColor: theme.color.primary },
                pressed && styles.doneButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.doneLabel,
                  {
                    color: theme.color.primaryForeground,
                    fontFamily: theme.typography.fontFamily.sans.semibold,
                  },
                ]}
              >
                {planCopy.adaptationDetails.close}
              </Text>
            </Pressable>
          </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  container: {
    width: "100%",
    zIndex: 1,
  },
  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    paddingTop: 12,
    gap: 20,
    overflow: "hidden",
  },
  handleContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  metaSection: {
    flexDirection: "row",
    gap: 12,
  },
  metaBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  doneButton: {
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  doneButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  doneLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
});
