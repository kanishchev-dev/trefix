import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type ExecutionStep, type WorkoutExecution } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../../locales";
import { Card } from "../../../../shared/ui/card";
import { type Formatter } from "../../../profile/lib/profile-format";
import { planRows } from "../../../tracker/plan-format";
import { type WorkoutIntensity } from "../../lib/workout-intensity";
import { IntensityMeter } from "../intensity-scale";

/** Bar heights per intensity level inside the 72 px chart. */
const LEVEL_HEIGHTS = [12, 40, 66] as const;
const CHART_HEIGHT = 72;
/** Pace assumed for a distance-only step without a target, to give it a width. */
const FALLBACK_PACE_SEC_PER_KM = 360;

type Props = {
  execution: WorkoutExecution;
  /** Level of the whole workout: the main part of the session runs at it. */
  level: WorkoutIntensity;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  format: Formatter;
};

function stepMinutes(step: ExecutionStep): number {
  if (step.durationSec) return step.durationSec / 60;
  if (step.distanceM) {
    const pace = step.targetPace
      ? (step.targetPace.minSecPerKm + step.targetPace.maxSecPerKm) / 2
      : FALLBACK_PACE_SEC_PER_KM;
    return ((step.distanceM / 1000) * pace) / 60;
  }
  return 0;
}

function stepLevel(step: ExecutionStep, level: WorkoutIntensity): number {
  return step.kind === "work" || step.kind === "steady" ? level : 1;
}

/**
 * The session: an intensity profile over time (bar width = duration, height =
 * intensity) with captions tying it to the numbered steps listed under it.
 */
export function WorkoutStructure({
  execution,
  level,
  theme,
  themeMode,
  copy,
  format,
}: Props) {
  const t = copy.today.details;
  const paceUnit =
    format.units === "imperial" ? format.labels.perMi : format.labels.perKm;

  const rows = useMemo(
    () =>
      planRows(execution.steps, copy.tracker, format.units, paceUnit).map(
        (row) => ({
          ...row,
          minutes: row.steps.reduce((sum, step) => sum + stepMinutes(step), 0),
          level: Math.max(...row.steps.map((step) => stepLevel(step, level))),
        }),
      ),
    [copy.tracker, execution.steps, format.units, level, paceUnit],
  );
  const bars = execution.steps
    .map((step) => ({
      key: step.index,
      minutes: stepMinutes(step),
      level: stepLevel(step, level),
    }))
    .filter((bar) => bar.minutes > 0);

  const total = [
    format.minutes(Math.round(execution.totalDurationSec / 60)),
    execution.totalDistanceM
      ? format.distance(execution.totalDistanceM / 1000)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const lit = [
    theme.color.intensity1,
    theme.color.intensity2,
    theme.color.intensity3,
  ];
  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const strong = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };
  const showChart = rows.length > 1 && bars.length > 1;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[styles.title, strong]}>
          {t.session}
        </Text>
        <Text style={[styles.caption, muted]}>{total}</Text>
      </View>
      <Card size="sm" theme={theme} themeMode={themeMode}>
        {showChart ? (
          <View>
            <View style={styles.chartRow}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.axis}
              >
                {([3, 2, 1] as const).map((value) => (
                  <Text key={value} style={[styles.axisLabel, muted]}>
                    {t.chartLevels[value]}
                  </Text>
                ))}
              </View>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={rows
                  .map(
                    (row) =>
                      `${row.label}: ${copy.today.workout.intensity[row.level as WorkoutIntensity]}`,
                  )
                  .join(", ")}
                style={[
                  styles.chart,
                  { borderBottomColor: theme.color.separator },
                ]}
              >
                {[LEVEL_HEIGHTS[2], LEVEL_HEIGHTS[1]].map((height) => (
                  <View
                    key={height}
                    style={[
                      styles.guide,
                      {
                        top: CHART_HEIGHT - height,
                        borderTopColor: theme.color.separator,
                      },
                    ]}
                  />
                ))}
                {bars.map((bar) => (
                  <View
                    key={bar.key}
                    style={[
                      styles.bar,
                      {
                        flexGrow: bar.minutes,
                        height: LEVEL_HEIGHTS[bar.level - 1],
                        backgroundColor: lit[bar.level - 1],
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.captions}
            >
              {rows.map((row, index) => (
                <View
                  key={row.key}
                  style={[
                    styles.captionCell,
                    {
                      flexGrow: Math.max(row.minutes, 0.1),
                      borderTopColor: theme.color.foreground,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.captionText, muted]}>
                    <Text style={strong}>{index + 1}</Text> {row.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={showChart ? styles.listAfterChart : undefined}>
          {rows.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.step,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.color.separator,
                },
              ]}
            >
              <Text style={[styles.stepIndex, muted]}>{index + 1}</Text>
              <View style={styles.stepText}>
                <Text style={[styles.caption, muted]}>{row.label}</Text>
                <Text style={[styles.stepDetail, strong]}>{row.detail}</Text>
                {row.pace ? (
                  <Text style={[styles.caption, muted]}>{row.pace}</Text>
                ) : null}
              </View>
              <IntensityMeter theme={theme} level={row.level} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
  chartRow: {
    flexDirection: "row",
    gap: 8,
  },
  axis: {
    width: 56,
    height: CHART_HEIGHT,
    justifyContent: "space-between",
  },
  axisLabel: {
    fontSize: 11,
    lineHeight: 12,
  },
  chart: {
    flex: 1,
    height: CHART_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  guide: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  bar: {
    flexBasis: 0,
    flexShrink: 1,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  captions: {
    marginTop: 8,
    marginLeft: 64,
    flexDirection: "row",
    gap: 2,
  },
  captionCell: {
    flexBasis: 0,
    flexShrink: 1,
    minWidth: 0,
    borderTopWidth: 2,
    paddingTop: 6,
  },
  captionText: {
    fontSize: 12,
    lineHeight: 16,
  },
  listAfterChart: {
    marginTop: 12,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 12,
  },
  stepIndex: {
    width: 16,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  stepDetail: {
    fontSize: 15,
    lineHeight: 20,
  },
});
