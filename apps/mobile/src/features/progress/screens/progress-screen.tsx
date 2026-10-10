import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ProgressPeriodKey, type RecordDistance } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Segmented } from "@workspace/ui-native";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { HeaderLogo, HeaderSparklesButton } from "../../main/components/header";
import { SectionLayout } from "../../main/components/section-layout";
import { useHeaderOptions } from "../../main/context/header-context";
import { usePlansNavigation } from "../../plans/plans-navigation";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { AddResultSheet } from "../components/add-result-sheet";
import {
  AchievementsSection,
  CapabilitiesSection,
  DynamicsSection,
  FormSection,
  ForecastCard,
  GoalCard,
  RecordsSection,
} from "../components/progress-sections";
import { ProgressSkeleton } from "../components/progress-skeleton";
import { useProgressOverview } from "../hooks/use-progress-v2";

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

const PERIODS: ProgressPeriodKey[] = ["4W", "8W", "3M", "6M", "1Y"];

/** Progress tab: goal forecast, form, capabilities, records, dynamics and achievements. */
export function ProgressScreen({
  theme,
  themeMode,
  copy,
  language,
  coachEnabled,
  onOpenTrefix,
  onOpenRecords,
  onOpenMetric,
  onOpenHeart,
  onOpenSchedule,
}: Props) {
  const [period, setPeriod] = useState<ProgressPeriodKey>("3M");
  const [addDistance, setAddDistance] = useState<RecordDistance | null | undefined>(undefined);
  const overview = useProgressOverview(period);
  const format = useUnitFormat(copy, language);
  const navigation = usePlansNavigation();

  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  useHeaderOptions(
    {
      leftAction: null,
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: coachEnabled ? <HeaderSparklesButton theme={theme} themeMode={themeMode} onPress={onOpenTrefix} /> : null,
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, logoSource, coachEnabled, onOpenTrefix],
  );

  const common = { copy, language, theme, format };
  const data = overview.data;

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      theme={theme}
      themeMode={themeMode}
      refreshing={overview.isRefetching}
      onRefresh={() => void overview.refetch()}
    >
      <View style={styles.stack}>
        <Segmented
          segments={PERIODS.map((value) => ({ value, label: copy.progress.periods[value] }))}
          value={period}
          onChange={setPeriod}
          theme={theme}
          themeMode={themeMode}
        />

        {data ? (
          <>
            {data.goal ? (
              <GoalCard {...common} overview={data} onOpenPlan={navigation.openPlanTab} />
            ) : (
              <ForecastCard {...common} overview={data} onSetGoal={navigation.openCreationMethod} />
            )}
            <FormSection {...common} overview={data} onOpenMetric={onOpenMetric} onOpenHeart={onOpenHeart} />
            <CapabilitiesSection {...common} overview={data} />
            <RecordsSection {...common} overview={data} onOpenRecords={onOpenRecords} onAddResult={setAddDistance} />
            <DynamicsSection {...common} overview={data} onOpenSchedule={onOpenSchedule} />
            <AchievementsSection {...common} overview={data} />
          </>
        ) : overview.isError ? (
          <View style={styles.errorCard}>
            <Text style={[styles.errorText, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
              {copy.progress.loadError}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void overview.refetch()}
              style={({ pressed }) => [styles.retry, { backgroundColor: theme.color.controlSecondary }, pressed && styles.pressed]}
            >
              <Text style={[styles.errorText, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
                {copy.progress.retry}
              </Text>
            </Pressable>
          </View>
        ) : (
          <ProgressSkeleton theme={theme} themeMode={themeMode} />
        )}
      </View>

      <AddResultSheet
        visible={addDistance !== undefined}
        initialDistance={addDistance ?? null}
        onClose={() => setAddDistance(undefined)}
        copy={copy}
        language={language}
        theme={theme}
        themeMode={themeMode}
      />
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 32, paddingTop: 4 },
  errorCard: { gap: 12, alignItems: "flex-start" },
  errorText: { fontSize: 15, lineHeight: 20 },
  retry: { height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: "center" },
  pressed: { opacity: 0.82 },
});
