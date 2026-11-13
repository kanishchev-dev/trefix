import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeTokens } from "@trefix/tokens";

import { SheetTabs } from "../../../../shared/ui/sheet-controls";

import {
  type ProgressMetric,
  type ProgressPeriod,
  type ProgressSnapshot,
  type ProgressTab,
} from "../../data/progress-model";
import {
  bucketsFor,
  comparisonFor,
  metricValue,
  totalsFor,
} from "../../lib/progress-selectors";
import {
  compareText,
  headlineText,
  metricTabText,
  type ProgressTextContext,
} from "../../lib/progress-text";
import { Caption, fonts, progressPalette } from "../progress-ui";
import { GoalBlock } from "./goal-block";
import { PeriodChart } from "./period-chart";

/** Same offset SectionLayout leaves for the floating header. */
const HEADER_OFFSET = 78;
const PERIODS: ProgressPeriod[] = ["week", "month", "year", "all"];
const METRICS: ProgressMetric[] = ["distance", "time", "elevation"];

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  snapshot: ProgressSnapshot;
  showTabs: boolean;
  tab: ProgressTab;
  onTabChange: (tab: ProgressTab) => void;
  period: ProgressPeriod;
  onPeriodChange: (period: ProgressPeriod) => void;
  metric: ProgressMetric;
  onMetricChange: (metric: ProgressMetric) => void;
  /** Selected bar; null picks the latest bar with a value. */
  selectedBar: number | null;
  onSelectBar: (index: number) => void;
  onOpenGoal: () => void;
};

/**
 * Open top block of the section, like the plan hero: tabs, the goal of the
 * plan in progress and the totals of the period with a chart.
 */
export function ProgressHeader({
  theme,
  ctx,
  snapshot,
  showTabs,
  tab,
  onTabChange,
  period,
  onPeriodChange,
  metric,
  onMetricChange,
  selectedBar,
  onSelectBar,
  onOpenGoal,
}: Props) {
  const insets = useSafeAreaInsets();
  const headerSpace = insets.top + HEADER_OFFSET;
  const t = ctx.copy.progressOverview;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const overview = tab === "overview";

  const totals = totalsFor(snapshot, period);
  const buckets = bucketsFor(snapshot, period, metric);
  const latest = buckets.reduce(
    (last, bucket, index) => (bucket.state === "value" ? index : last),
    0,
  );
  const selected =
    selectedBar !== null && selectedBar < buckets.length ? selectedBar : latest;
  const hasChart = buckets.some((bucket) => bucket.state === "value");
  const showGoal = snapshot.goal !== null && snapshot.plan !== null;

  return (
    <View
      style={[
        styles.hero,
        {
          marginTop: -headerSpace,
          paddingTop: headerSpace + 8,
          paddingBottom: overview ? 24 : 16,
          backgroundColor: theme.color.card,
          borderBottomColor: palette.line,
        },
      ]}
    >
      {showTabs ? (
        <SheetTabs
          tabs={[
            { key: "overview" as ProgressTab, label: t.tabs.overview },
            { key: "analytics" as ProgressTab, label: t.tabs.analytics },
          ]}
          value={tab}
          onChange={onTabChange}
          theme={theme}
          trackColor={theme.color.screen}
        />
      ) : null}

      {overview ? (
        <>
          {showGoal && snapshot.goal && snapshot.plan ? (
            <View style={{ marginTop: showTabs ? 22 : 4 }}>
              <GoalBlock
                theme={theme}
                ctx={ctx}
                goal={snapshot.goal}
                plan={snapshot.plan}
                asOf={snapshot.asOf}
                onPress={onOpenGoal}
              />
            </View>
          ) : null}

          <View style={{ marginTop: showGoal ? 22 : showTabs ? 14 : 4 }}>
            <SheetTabs
              tabs={PERIODS.map((value) => ({
                key: value,
                label: t.periods[value],
              }))}
              value={period}
              onChange={onPeriodChange}
              theme={theme}
              trackColor={theme.color.screen}
            />
          </View>

          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[
              styles.headline,
              { color: palette.fg, fontFamily: font.medium },
            ]}
          >
            {headlineText(ctx, period, totals.count, snapshot.asOf)}
          </Text>

          <View
            accessibilityRole="tablist"
            style={[styles.metrics, { borderBottomColor: palette.line }]}
          >
            {METRICS.map((item) => {
              const isSelected = item === metric;
              const color = isSelected ? palette.fg : palette.muted;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onMetricChange(item)}
                  style={[
                    styles.metric,
                    {
                      borderBottomColor: isSelected
                        ? palette.fg
                        : "transparent",
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.metricLabel,
                      { color, fontFamily: font.medium },
                    ]}
                  >
                    {t.metrics[item]}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.metricValue,
                      { color, fontFamily: font.medium },
                    ]}
                  >
                    {metricTabText(ctx, item, metricValue(totals, item))}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Caption theme={theme} numberOfLines={2} style={styles.compare}>
            {compareText(
              ctx,
              metric,
              period,
              comparisonFor(snapshot, period, metric),
              snapshot.asOf,
              snapshot.firstWorkoutDate,
            )}
          </Caption>

          {hasChart ? (
            <PeriodChart
              theme={theme}
              ctx={ctx}
              period={period}
              metric={metric}
              buckets={buckets}
              selected={selected}
              onSelect={onSelectBar}
            />
          ) : (
            <View style={[styles.noData, { borderColor: palette.faint }]}>
              <Text
                style={[
                  styles.noDataTitle,
                  { color: palette.fg, fontFamily: font.medium },
                ]}
              >
                {t.chart.noElevationTitle}
              </Text>
              <Caption theme={theme} style={styles.center}>
                {t.chart.noElevationText}
              </Caption>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, borderBottomWidth: 1 },
  headline: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 20,
  },
  metrics: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
    borderBottomWidth: 1,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 6,
    paddingBottom: 16,
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  metricLabel: { fontSize: 13, lineHeight: 18 },
  metricValue: { fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  compare: { marginTop: 12, textAlign: "center" },
  noData: {
    marginTop: 22,
    height: 150,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 24,
  },
  noDataTitle: { fontSize: 15, lineHeight: 20 },
  center: { textAlign: "center" },
});
