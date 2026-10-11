import { StyleSheet, Text, View } from "react-native";

import { type PlanWeek } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { PlanWeekItem } from "./plan-week-item";
import { type MainCopy } from "../../../locales";
import { type PlanTimelineMode } from "../../plans/lib/plan-weeks";

type Props = {
  weeks: PlanWeek[];
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onSelectWeek: (week: PlanWeek) => void;
  /** `relative` — draft weeks without dates, `history` — a finished plan. */
  mode?: PlanTimelineMode;
};

export function PlanTimeline({
  weeks,
  theme,
  themeMode,
  copy,
  onSelectWeek,
  mode = "active",
}: Props) {
  const planCopy = copy.plan;

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.sectionHeader,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {planCopy.timeline.header.toUpperCase()}
      </Text>

      <View style={styles.timelineWrapper}>
        {/* Continuous Vertical Connecting Line */}
        <View
          style={[styles.timelineLine, { backgroundColor: theme.color.border }]}
        />

        <View style={styles.weeksList}>
          {weeks.map((week, index) => {
            const previousWeek = index > 0 ? weeks[index - 1] : null;
            const isPhaseTransition =
              previousWeek && previousWeek.phase !== week.phase;

            const phaseLabel = planCopy.phases[week.phase] || week.phase;

            return (
              <View key={week.id} style={styles.weekItemWrapper}>
                {/* Phase Transition Divider */}
                {isPhaseTransition ? (
                  <View style={styles.phaseTransitionRow}>
                    <View
                      style={[
                        styles.phaseTransitionLine,
                        { backgroundColor: theme.color.border },
                      ]}
                    />
                    <View
                      style={[
                        styles.phaseTransitionPill,
                        {
                          backgroundColor: theme.color.surfaceElevated,
                          borderColor: theme.color.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.phaseTransitionText,
                          {
                            color: theme.color.foreground,
                            fontFamily: theme.typography.fontFamily.sans.bold,
                          },
                        ]}
                      >
                        {phaseLabel}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.phaseTransitionLine,
                        { backgroundColor: theme.color.border },
                      ]}
                    />
                  </View>
                ) : null}

                <PlanWeekItem
                  mode={mode}
                  copy={copy}
                  onPress={onSelectWeek}
                  theme={theme}
                  themeMode={themeMode}
                  week={week}
                />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  sectionHeader: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  timelineWrapper: {
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    left: 23, // center aligned with node marker
    top: 14,
    bottom: 14,
    width: 2,
  },
  weeksList: {
    gap: 8,
  },
  weekItemWrapper: {
    gap: 8,
  },
  phaseTransitionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingLeft: 36,
  },
  phaseTransitionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  phaseTransitionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },
  phaseTransitionText: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
});
