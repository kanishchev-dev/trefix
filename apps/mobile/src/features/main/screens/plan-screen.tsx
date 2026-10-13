import { useCallback, useMemo, useState } from "react";

import { type PlanAdaptation, type PlanWeek } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  HeaderLogo,
  HeaderPlusButton,
  HeaderTextButton,
} from "../components/header";
import { useHeaderOptions } from "../context/header-context";
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
import { usePlanOverview } from "../../plan/hooks/use-plan-overview";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import { PendingAdaptationsCard } from "../../plans/components/pending-adaptations-card";
import { PlanActionsMenu } from "../../plans/components/plan-actions-menu";
import { PlanWorkoutAddSheet } from "../../plans/components/plan-workout-add-sheet";
import { usePlanDetails } from "../../plans/hooks/use-plan";
import { usePlanCounts, usePlansList } from "../../plans/hooks/use-plans";
import {
  addDaysIso,
  mondayBasedWeekday,
  todayIso,
  workoutLocalDate,
} from "../../plans/lib/plan-dates";
import { weekWorkoutRows } from "../../plans/lib/plan-weeks";
import { pushSubScreen } from "../main-routes";
import { usePlansNavigation } from "../../plans/plans-navigation";
import {
  formatDayMonth,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

export function PlanScreen({ theme, themeMode, copy, language }: Props) {
  const navigation = usePlansNavigation();
  const { displayState, data, refresh, isRefreshing } = usePlanOverview();
  const isEmpty = displayState === "empty";
  const countsQuery = usePlanCounts();
  const draftsQuery = usePlansList(
    "draft",
    isEmpty && (countsQuery.data?.draft ?? 0) > 0,
  );
  const planId = data && !isEmpty ? data.plan.id : null;
  const detailsQuery = usePlanDetails(planId);
  const details = detailsQuery.data;

  const [selectedWeek, setSelectedWeek] = useState<PlanWeek | null>(null);
  const [selectedAdaptation, setSelectedAdaptation] =
    useState<PlanAdaptation | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  // The week sheet is a modal: close it first, or it would cover the pushed screen.
  const openWorkout = useCallback((workoutId: string) => {
    setSelectedWeek(null);
    pushSubScreen({ kind: "workout-details", workoutId });
  }, []);
  const [addTarget, setAddTarget] = useState<{
    planId: string;
    date: string;
  } | null>(null);

  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  useHeaderOptions(
    {
      leftAction: (
        <HeaderTextButton
          accessibilityLabel={copy.plans.tab.openPlans}
          label={copy.plans.tab.plansButton}
          onPress={() => navigation.openPlans({ source: "plan_tab" })}
          theme={theme}
          themeMode={themeMode}
        />
      ),
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: (
        <HeaderPlusButton
          onPress={navigation.openCreationMethod}
          theme={theme}
          themeMode={themeMode}
        />
      ),
      variant: "default",
      bottomContent: null,
    },
    [
      logoSource,
      copy.plans.tab.openPlans,
      copy.plans.tab.plansButton,
      navigation,
    ],
  );

  const dayNames = shortDayNamesFor(language);
  const weekRows = useMemo(() => {
    if (!details || !selectedWeek) return undefined;
    return weekWorkoutRows(
      details,
      selectedWeek.weekNumber,
      dayNames,
      (iso) => {
        const date = workoutLocalDate(iso);
        return `${dayNames[mondayBasedWeekday(date)]} ${formatDayMonth(date, language)}`;
      },
    );
  }, [dayNames, details, language, selectedWeek]);

  // Workouts can be added to the current and future weeks of the plan in progress.
  const addWorkoutTo = (week: PlanWeek): (() => void) | undefined => {
    if (
      displayState !== "active" ||
      !details?.startDate ||
      week.status === "completed"
    )
      return undefined;
    const weekStart = addDaysIso(details.startDate, (week.weekNumber - 1) * 7);
    const today = todayIso();
    return () =>
      setAddTarget({
        planId: details.id,
        date: weekStart > today ? weekStart : today,
      });
  };

  const handleRefresh = () => {
    refresh();
    void countsQuery.refetch();
  };

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
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
          language={language}
          counts={countsQuery.data}
          drafts={draftsQuery.data?.pages[0]?.items}
          onCreatePlan={navigation.openCreationMethod}
          onOpenPlans={() =>
            navigation.openPlans({ segment: "draft", source: "plan_tab_empty" })
          }
          onOpenHistory={() =>
            navigation.openPlans({
              segment: "history",
              source: "plan_tab_empty",
            })
          }
          onStartDraft={(plan) => navigation.startDraft(plan, "plan_tab_empty")}
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
          onNewGoal={navigation.openCreationMethod}
          onPrepareAgain={() =>
            navigation.openCreation({
              mode: "rebuild",
              sourcePlanId: data.plan.id,
            })
          }
          onOpenPlans={() =>
            navigation.openPlans({
              segment: "history",
              source: "plan_completed",
            })
          }
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
            onOpenActions={() => setActionsOpen(true)}
            theme={theme}
            themeMode={themeMode}
          />

          <PendingAdaptationsCard
            copy={copy}
            language={language}
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
        mode={displayState === "completed" ? "history" : "active"}
        week={selectedWeek}
        workouts={weekRows}
        onSelectWorkout={openWorkout}
        onAddWorkout={selectedWeek ? addWorkoutTo(selectedWeek) : undefined}
        onClose={() => setSelectedWeek(null)}
        theme={theme}
        themeMode={themeMode}
        visible={selectedWeek !== null}
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

      {data && displayState === "active" ? (
        <PlanActionsMenu
          visible={actionsOpen}
          onClose={() => setActionsOpen(false)}
          overview={data}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
        />
      ) : null}

      <PlanWorkoutAddSheet
        visible={addTarget !== null}
        planId={addTarget?.planId ?? null}
        defaultDate={addTarget?.date}
        onClose={() => setAddTarget(null)}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
        language={language}
      />
    </SectionLayout>
  );
}
