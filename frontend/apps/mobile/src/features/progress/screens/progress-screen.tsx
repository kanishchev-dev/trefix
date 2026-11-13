import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Trophy } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  formatMonthYear,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  HeaderLogo,
  HeaderSparklesButton,
  HeaderActionButton,
} from "../../main/components/header";
import { SectionLayout } from "../../main/components/section-layout";
import { useHeaderOptions } from "../../main/context/header-context";
import { pushSubScreen } from "../../main/main-routes";
import { usePlansNavigation } from "../../plans/plans-navigation";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { FormBlock, PaceBlock } from "../components/analytics/form-pace-blocks";
import {
  HeartRateBlock,
  LoadBlock,
  RegularityBlock,
} from "../components/analytics/body-blocks";
import {
  InsightsBlock,
  PlanAnalysisBlock,
} from "../components/analytics/coach-blocks";
import { HighlightsCard } from "../components/overview/highlights-card";
import { PlanExecutionCard } from "../components/overview/plan-execution-card";
import { ProgressHeader } from "../components/overview/progress-header";
import { WorkoutsCard } from "../components/overview/workouts-card";
import { ProgressEmpty } from "../components/progress-empty";
import { fonts, progressPalette } from "../components/progress-ui";
import {
  type ProgressMetric,
  type ProgressPeriod,
  type ProgressSnapshot,
  type ProgressTab,
} from "../data/progress-model";
import { useProgressSnapshot } from "../hooks/use-progress-snapshot";
import {
  parseYmd,
  sectionLayoutFor,
  workoutsFor,
} from "../lib/progress-selectors";
import { type ProgressTextContext } from "../lib/progress-text";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  coachEnabled: boolean;
  onOpenTrefix: () => void;
  onOpenRecords: () => void;
  onOpenMetric: (metric: "threshold_pace" | "vo2max") => void;
  onOpenHeart: () => void;
  onOpenSchedule: () => void;
};

/**
 * Progress tab: the athlete's history on facts. Overview — totals of a period,
 * the main change, plan completion and workouts; Analytics — trends by block.
 */
export function ProgressScreen({
  theme,
  themeMode,
  copy,
  language,
  coachEnabled,
  onOpenTrefix,
  onOpenRecords,
}: Props) {
  const [tab, setTab] = useState<ProgressTab>("overview");
  const [period, setPeriod] = useState<ProgressPeriod>("month");
  const [metric, setMetric] = useState<ProgressMetric>("distance");
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const snapshot = useProgressSnapshot();
  const format = useUnitFormat(copy, language);
  const navigation = usePlansNavigation();
  const ctx: ProgressTextContext = { copy, language, format };

  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  useHeaderOptions(
    {
      leftAction: (
        <HeaderActionButton
          accessibilityLabel={copy.progressOverview.records}
          icon={
            <Trophy
              color={theme.color.foreground}
              size={20}
              strokeWidth={2.2}
            />
          }
          theme={theme}
          themeMode={themeMode}
          onPress={onOpenRecords}
        />
      ),
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: coachEnabled ? (
        <HeaderSparklesButton
          theme={theme}
          themeMode={themeMode}
          onPress={onOpenTrefix}
        />
      ) : null,
      variant: "default",
      bottomContent: null,
    },
    [
      theme,
      themeMode,
      logoSource,
      coachEnabled,
      onOpenTrefix,
      onOpenRecords,
      copy,
    ],
  );

  const data = snapshot.data;
  const layout = data ? sectionLayoutFor(data) : null;
  const activeTab: ProgressTab = layout?.showTabs ? tab : "overview";

  const changePeriod = (value: ProgressPeriod) => {
    setPeriod(value);
    setSelectedBar(null);
  };
  const changeMetric = (value: ProgressMetric) => {
    setMetric(value);
    setSelectedBar(null);
  };

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      theme={theme}
      themeMode={themeMode}
      contentStyle={styles.content}
      refreshing={snapshot.isRefetching}
      onRefresh={() => void snapshot.refetch()}
    >
      {data && layout ? (
        layout.empty ? (
          <ProgressEmpty
            theme={theme}
            copy={copy}
            onRecord={() => pushSubScreen({ kind: "tracker-setup" })}
            onImport={() => pushSubScreen({ kind: "integrations" })}
          />
        ) : (
          <>
            <ProgressHeader
              theme={theme}
              ctx={ctx}
              snapshot={data}
              showTabs={layout.showTabs}
              tab={activeTab}
              onTabChange={setTab}
              period={period}
              onPeriodChange={changePeriod}
              metric={metric}
              onMetricChange={changeMetric}
              selectedBar={selectedBar}
              onSelectBar={setSelectedBar}
              onOpenGoal={navigation.openPlanTab}
            />
            {activeTab === "overview" ? (
              <Overview
                theme={theme}
                ctx={ctx}
                snapshot={data}
                period={period}
                onOpenPlan={navigation.openPlanTab}
              />
            ) : (
              <Analytics theme={theme} ctx={ctx} snapshot={data} />
            )}
          </>
        )
      ) : snapshot.isError ? (
        <LoadError
          theme={theme}
          copy={copy}
          onRetry={() => void snapshot.refetch()}
        />
      ) : null}
    </SectionLayout>
  );
}

function LoadError({
  theme,
  copy,
  onRetry,
}: {
  theme: ThemeTokens;
  copy: MainCopy;
  onRetry: () => void;
}) {
  const palette = progressPalette(theme);
  const font = fonts(theme);
  return (
    <View style={styles.error}>
      <Text
        style={[
          styles.errorText,
          { color: palette.muted, fontFamily: font.regular },
        ]}
      >
        {copy.progress.loadError}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retry,
          { backgroundColor: palette.card },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.retryText,
            { color: palette.fg, fontFamily: font.medium },
          ]}
        >
          {copy.progress.retry}
        </Text>
      </Pressable>
    </View>
  );
}

type OverviewProps = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  snapshot: ProgressSnapshot;
  period: ProgressPeriod;
  onOpenPlan: () => void;
};

function Overview({ theme, ctx, snapshot, period, onOpenPlan }: OverviewProps) {
  return (
    <>
      <HighlightsCard
        theme={theme}
        ctx={ctx}
        snapshot={snapshot}
        period={period}
      />
      <PlanExecutionCard
        theme={theme}
        ctx={ctx}
        snapshot={snapshot}
        period={period}
        onPress={onOpenPlan}
      />
      <WorkoutsCard
        theme={theme}
        ctx={ctx}
        workouts={workoutsFor(snapshot, period)}
        hasPlan={snapshot.plan !== null}
        onOpenWorkout={(workoutId) =>
          pushSubScreen({ kind: "workout-details", workoutId })
        }
      />
    </>
  );
}

type AnalyticsProps = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  snapshot: ProgressSnapshot;
};

function Analytics({ theme, ctx, snapshot }: AnalyticsProps) {
  const analytics = snapshot.analytics;
  const hasPlan = snapshot.plan !== null;
  const { year, month } = parseYmd(snapshot.asOf);
  const common = { theme, ctx, analytics };
  return (
    <>
      <FormBlock {...common} />
      <PaceBlock {...common} />
      <HeartRateBlock
        {...common}
        monthLabel={formatMonthYear(new Date(year, month, 1), ctx.language)}
      />
      <LoadBlock {...common} />
      <RegularityBlock {...common} hasPlan={hasPlan} />
      {hasPlan ? <PlanAnalysisBlock {...common} /> : null}
      <InsightsBlock
        {...common}
        hasHeartRate={analytics.heartRateZones !== null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, gap: 12 },
  error: {
    paddingTop: 120,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
  },
  errorText: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  retry: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    justifyContent: "center",
  },
  retryText: { fontSize: 15 },
  pressed: { opacity: 0.7 },
});
