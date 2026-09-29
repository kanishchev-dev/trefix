import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Activity, Dumbbell, Sparkles, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type PlanAdaptation, type PlanWeek } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";

type Props = {
  week: PlanWeek | null;
  adaptations?: PlanAdaptation[];
  visible: boolean;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

export function PlanWeekDetailsSheet({
  week,
  adaptations = [],
  visible,
  onClose,
  theme,
  themeMode,
  copy,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!week) return null;

  const planCopy = copy.plan;
  const phaseLabel = planCopy.phases[week.phase] || week.phase;

  const weekAdaptations = adaptations.filter(
    (a) => a.weekId === week.id || a.weekNumber === week.weekNumber,
  );

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
                <Text
                  style={[
                    styles.weekTitle,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.extrabold,
                    },
                  ]}
                >
                  {planCopy.weekDetails.title.replace(
                    "{{number}}",
                    String(week.weekNumber),
                  )}
                </Text>
                <View
                  style={[
                    styles.phaseBadge,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.phaseBadgeText,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.bold,
                      },
                    ]}
                  >
                    {phaseLabel}
                  </Text>
                </View>
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

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Focus Title */}
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
                  {planCopy.weekDetails.weeklyFocus.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.focusText,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {week.title}
                </Text>
              </View>

              {/* Training Intent */}
              {week.intent ? (
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
                    {planCopy.weekDetails.trainingIntent.toUpperCase()}
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
                    {week.intent}
                  </Text>
                </View>
              ) : null}

              {/* Planned Volume Stats */}
              {(week.plannedWorkoutsCount || week.plannedDistance) ? (
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
                    {planCopy.weekDetails.plannedVolume.toUpperCase()}
                  </Text>

                  <View style={styles.statsGrid}>
                    {week.plannedWorkoutsCount ? (
                      <View
                        style={[
                          styles.statBox,
                          {
                            backgroundColor: theme.color.surface,
                            borderColor: theme.color.border,
                          },
                        ]}
                      >
                        <Dumbbell color={theme.color.accent} size={18} />
                        <View>
                          <Text
                            style={[
                              styles.statValue,
                              {
                                color: theme.color.foreground,
                                fontFamily: theme.typography.fontFamily.sans.extrabold,
                              },
                            ]}
                          >
                            {week.plannedWorkoutsCount}
                          </Text>
                          <Text
                            style={[
                              styles.statLabel,
                              {
                                color: theme.color.mutedForeground,
                                fontFamily: theme.typography.fontFamily.sans.medium,
                              },
                            ]}
                          >
                            {planCopy.weekDetails.workouts}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {week.plannedDistance ? (
                      <View
                        style={[
                          styles.statBox,
                          {
                            backgroundColor: theme.color.surface,
                            borderColor: theme.color.border,
                          },
                        ]}
                      >
                        <Activity color={theme.color.accent} size={18} />
                        <View>
                          <Text
                            style={[
                              styles.statValue,
                              {
                                color: theme.color.foreground,
                                fontFamily: theme.typography.fontFamily.sans.extrabold,
                              },
                            ]}
                          >
                            {week.plannedDistance}
                          </Text>
                          <Text
                            style={[
                              styles.statLabel,
                              {
                                color: theme.color.mutedForeground,
                                fontFamily: theme.typography.fontFamily.sans.medium,
                              },
                            ]}
                          >
                            {planCopy.weekDetails.distance}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Key Sessions */}
              {week.keySessions && week.keySessions.length > 0 ? (
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
                    {planCopy.weekDetails.keySessions.toUpperCase()}
                  </Text>
                  <View style={styles.sessionsList}>
                    {week.keySessions.map((session, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.sessionCard,
                          {
                            backgroundColor: theme.color.surface,
                            borderColor: theme.color.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.sessionDot,
                            { backgroundColor: theme.color.primary },
                          ]}
                        />
                        <Text
                          style={[
                            styles.sessionText,
                            {
                              color: theme.color.foreground,
                              fontFamily: theme.typography.fontFamily.sans.medium,
                            },
                          ]}
                        >
                          {session}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Adaptations on this week */}
              {weekAdaptations.length > 0 ? (
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
                    {planCopy.weekDetails.changesThisWeek.toUpperCase()}
                  </Text>
                  <View style={styles.adaptationsList}>
                    {weekAdaptations.map((a) => (
                      <View
                        key={a.id}
                        style={[
                          styles.adaptationCard,
                          {
                            backgroundColor: theme.color.surface,
                            borderColor: theme.color.border,
                          },
                        ]}
                      >
                        <Sparkles color={theme.color.accent} size={16} />
                        <View style={styles.adaptationTextWrapper}>
                          <Text
                            style={[
                              styles.adaptationTitle,
                              {
                                color: theme.color.foreground,
                                fontFamily: theme.typography.fontFamily.sans.bold,
                              },
                            ]}
                          >
                            {a.title}
                          </Text>
                          {a.description ? (
                            <Text
                              style={[
                                styles.adaptationDesc,
                                {
                                  color: theme.color.mutedForeground,
                                  fontFamily: theme.typography.fontFamily.sans.regular,
                                },
                              ]}
                            >
                              {a.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>

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
                {planCopy.weekDetails.close}
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
    maxHeight: "85%",
    zIndex: 1,
  },
  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    paddingTop: 12,
    gap: 16,
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
  },
  weekTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  phaseBadgeText: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    gap: 20,
    paddingVertical: 8,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
  },
  focusText: {
    fontSize: 18,
    lineHeight: 24,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  sessionsList: {
    gap: 8,
    marginTop: 4,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  adaptationsList: {
    gap: 8,
    marginTop: 4,
  },
  adaptationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  adaptationTextWrapper: {
    flex: 1,
    gap: 2,
  },
  adaptationTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  adaptationDesc: {
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
