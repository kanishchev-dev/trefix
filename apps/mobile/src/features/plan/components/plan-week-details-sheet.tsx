import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Activity, Dumbbell, Sparkles } from "lucide-react-native";

import { type PlanAdaptation, type PlanWeek } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";
import { BottomSheet, SheetSectionLabel } from "../../../shared/ui/bottom-sheet";

type Props = {
  week: PlanWeek | null;
  adaptations?: PlanAdaptation[];
  visible: boolean;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/**
 * Week details rendered in the canonical app-wide bottom sheet
 * (shared BottomSheet shell extracted from the workout goal sheet).
 */
export function PlanWeekDetailsSheet({
  week,
  adaptations = [],
  visible,
  onClose,
  theme,
  themeMode,
  copy,
}: Props) {
  if (!week) {
    return (
      <BottomSheet visible={false} onClose={onClose} theme={theme} themeMode={themeMode} />
    );
  }

  const planCopy = copy.plan;
  const phaseLabel = planCopy.phases[week.phase] || week.phase;

  const weekAdaptations = adaptations.filter(
    (a) => a.weekId === week.id || a.weekNumber === week.weekNumber,
  );

  return (
    <BottomSheet
      title={planCopy.weekDetails.title.replace("{{number}}", String(week.weekNumber))}
      visible={visible}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Focus Title */}
        <View style={styles.section}>
          <SheetSectionLabel
            text={planCopy.weekDetails.weeklyFocus.toUpperCase()}
            theme={theme}
          />
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
            <SheetSectionLabel
              text={planCopy.weekDetails.trainingIntent.toUpperCase()}
              theme={theme}
            />
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
            <SheetSectionLabel
              text={planCopy.weekDetails.plannedVolume.toUpperCase()}
              theme={theme}
            />

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
            <SheetSectionLabel
              text={planCopy.weekDetails.keySessions.toUpperCase()}
              theme={theme}
            />
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
                    style={[styles.sessionDot, { backgroundColor: theme.color.primary }]}
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
            <SheetSectionLabel
              text={planCopy.weekDetails.changesThisWeek.toUpperCase()}
              theme={theme}
            />
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexShrink: 1,
    width: "100%",
  },
  scrollContent: {
    gap: 20,
    paddingVertical: 4,
  },
  section: {
    gap: 6,
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
    borderRadius: 9999,
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
