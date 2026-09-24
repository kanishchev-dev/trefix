import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type PlanAdaptation, type PlanWeek } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import {
  HeaderLogo,
  HeaderPlusButton,
  HeaderTemplateButton,
} from "../components/header";
import { SectionLayout } from "../components/section-layout";
import { CurrentWeekContextCard } from "../../plan/components/current-week-context-card";
import { PlanAdaptationDetailsSheet } from "../../plan/components/plan-adaptation-details-sheet";
import { PlanCompletedState } from "../../plan/components/plan-completed-state";
import { PlanEmptyState } from "../../plan/components/plan-empty-state";
import { PlanErrorState } from "../../plan/components/plan-error-state";
import { PlanNotStartedState } from "../../plan/components/plan-not-started-state";
import { PlanOverviewCard } from "../../plan/components/plan-overview-card";
import { PlanSkeleton } from "../../plan/components/plan-skeleton";
import { PlanTimeline } from "../../plan/components/plan-timeline";
import { PlanWeekDetailsSheet } from "../../plan/components/plan-week-details-sheet";
import { RecentAdaptationsCard } from "../../plan/components/recent-adaptations-card";
import {
  usePlanOverview,
  type PlanDisplayState,
} from "../../plan/hooks/use-plan-overview";
import { type MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onOpenTrefix?: () => void;
};

export function PlanScreen({ theme, themeMode, copy, onOpenTrefix }: Props) {
  const { displayState, data, refresh, isRefreshing } = usePlanOverview();

  const [selectedWeek, setSelectedWeek] = useState<PlanWeek | null>(null);
  const [selectedAdaptation, setSelectedAdaptation] =
    useState<PlanAdaptation | null>(null);

  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  const planCopy = copy.plan;

  return (
    <SectionLayout
      headerCenter={<HeaderLogo source={logoSource} />}
      scrollable
      refreshing={isRefreshing}
      onRefresh={refresh}
      theme={theme}
      themeMode={themeMode}
    >
      {/* State Rendering */}
      {displayState === "loading" ? (
        <PlanSkeleton theme={theme} themeMode={themeMode} />
      ) : displayState === "error" ? (
        <PlanErrorState
          copy={copy}
          onRetry={refresh}
          theme={theme}
          themeMode={themeMode}
        />
      ) : displayState === "empty" || !data ? (
        <PlanEmptyState
          copy={copy}
          onCreatePlan={() => {
            if (onOpenTrefix) {
              onOpenTrefix();
            }
          }}
          theme={theme}
          themeMode={themeMode}
        />
      ) : displayState === "not_started" ? (
        <PlanNotStartedState
          copy={copy}
          onSelectWeek={setSelectedWeek}
          overview={data}
          theme={theme}
          themeMode={themeMode}
        />
      ) : displayState === "completed" ? (
        <PlanCompletedState
          copy={copy}
          onNewGoal={() => {
            if (onOpenTrefix) {
              onOpenTrefix();
            } else {
              refresh();
            }
          }}
          onSelectWeek={setSelectedWeek}
          overview={data}
          theme={theme}
          themeMode={themeMode}
        />
      ) : (
        /* Active Plan View */
        <>
          {/* Plan Goal Overview */}
          <PlanOverviewCard
            copy={copy}
            overview={data}
            theme={theme}
            themeMode={themeMode}
          />

          {/* Training Plan Timeline */}
          <PlanTimeline
            copy={copy}
            onSelectWeek={setSelectedWeek}
            theme={theme}
            themeMode={themeMode}
            weeks={data.weeks}
          />

          {/* Current Week Context */}
          {data.currentWeekContext ? (
            <CurrentWeekContextCard
              context={data.currentWeekContext}
              copy={copy}
              theme={theme}
              themeMode={themeMode}
            />
          ) : null}

          {/* Recent Adaptations */}
          <RecentAdaptationsCard
            adaptations={data.adaptations}
            copy={copy}
            onSelectAdaptation={setSelectedAdaptation}
            theme={theme}
            themeMode={themeMode}
          />
        </>
      )}

      {/* Week Details Sheet */}
      <PlanWeekDetailsSheet
        adaptations={data?.adaptations}
        copy={copy}
        onClose={() => setSelectedWeek(null)}
        theme={theme}
        themeMode={themeMode}
        visible={selectedWeek !== null}
        week={selectedWeek}
      />

      {/* Adaptation Details Sheet */}
      <PlanAdaptationDetailsSheet
        adaptation={selectedAdaptation}
        copy={copy}
        onClose={() => setSelectedAdaptation(null)}
        theme={theme}
        themeMode={themeMode}
        visible={selectedAdaptation !== null}
      />
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stateBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stateBadgeText: {
    fontSize: 11,
    lineHeight: 15,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
