import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { MoreHorizontal } from "lucide-react-native";

import { type PlanAdaptation } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { formatHoursMinutesSeconds } from "@trefix/utils";

import {
  HeaderActionButton,
  HeaderLogo,
  HeaderPlusButton,
  HeaderTextButton,
} from "../components/header";
import { WorkoutCard } from "../components/today/day-event-cards";
import { workoutIntensity } from "../lib/workout-intensity";
import { type DayEvent } from "../today-types";
import { useHeaderOptions } from "../context/header-context";
import { SectionLayout } from "../components/section-layout";
import { PlanHero } from "../../plan/components/plan-hero";
import { CoachAdaptationRow } from "../../plan/components/coach-adaptation-row";
import { PlanAdaptationDetailsSheet } from "../../plan/components/plan-adaptation-details-sheet";
import { PlanCompletedState } from "../../plan/components/plan-completed-state";
import { PlanEmptyState } from "../../plan/components/plan-empty-state";
import { PlanErrorState } from "../../plan/components/plan-error-state";
import { PlanNotStartedState } from "../../plan/components/plan-not-started-state";
import { PlanSkeleton } from "../../plan/components/plan-skeleton";
import { PlanPhaseWeeks } from "../../plan/components/plan-phase-weeks";
import { PlanTimeline } from "../../plan/components/plan-timeline";
import { PlanWeekDetailsSheet } from "../../plan/components/plan-week-details-sheet";
import { ThisWeekCard } from "../../plan/components/this-week-card";
import { usePlanOverview } from "../../plan/hooks/use-plan-overview";
import {
  latestAdaptation,
  phaseGroups,
  planWeekStats,
  weekDays,
  weekStartDate,
  workoutsOn,
} from "../../plan/lib/active-plan-view";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import { PendingAdaptationsCard } from "../../plans/components/pending-adaptations-card";
import { PlanActionsMenu } from "../../plans/components/plan-actions-menu";
import { PlanWorkoutAddSheet } from "../../plans/components/plan-workout-add-sheet";
import { usePlanDetails } from "../../plans/hooks/use-plan";
import { usePlanCounts, usePlansList } from "../../plans/hooks/use-plans";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import {
  addDaysIso,
  mondayBasedWeekday,
  parseIsoDate,
  todayIso,
  workoutLocalDate,
} from "../../plans/lib/plan-dates";
import {
  keySessionLabel,
  planHeading,
  planTitle,
} from "../../plans/lib/plan-texts";
import {
  overviewWeekView,
  weekWorkoutRows,
  type PlanWeekView,
} from "../../plans/lib/plan-weeks";
import { pushSubScreen, useMainShell } from "../main-routes";
import { workoutTargetText } from "../../../shared/lib/workout-target";
import { usePlansNavigation } from "../../plans/plans-navigation";
import {
  fillTemplate,
  formatDateLong,
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

/** Backend status → card status; a skipped workout is shown as missed. */
function toDayEventStatus(status: string): DayEvent["status"] {
  if (status === "completed") return "completed";
  if (status === "skipped") return "missed";
  return "planned";
}

export function PlanScreen({ theme, themeMode, copy, language }: Props) {
  const navigation = usePlansNavigation();
  const { openTrefix } = useMainShell();
  const format = useUnitFormat(copy, language);
  const { displayState, data, refresh } = usePlanOverview();
  // The spinner follows the user's pull only: a background refetch (tab focus,
  // cache invalidation) must not open the pull-to-refresh gap and jump the screen.
  const [pulling, setPulling] = useState(false);
  const isEmpty = displayState === "empty";
  const isActive = displayState === "active" && data !== null;
  const countsQuery = usePlanCounts();
  const draftsQuery = usePlansList(
    "draft",
    isEmpty && (countsQuery.data?.draft ?? 0) > 0,
  );
  // A plan can be started from the library, the creation flow or the coach while
  // this tab sits frozen in the background: check again each time it is opened.
  const firstFocus = useRef(true);
  const refetchCounts = countsQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refresh();
      void refetchCounts();
    }, [refresh, refetchCounts]),
  );
  const planId = data && !isEmpty ? data.plan.id : null;
  const detailsQuery = usePlanDetails(planId);
  const details = detailsQuery.data;
  const weeks = useMemo(
    () => data?.weeks.map((week) => overviewWeekView(week, copy)) ?? [],
    [copy, data?.weeks],
  );
  const workouts = useMemo(() => details?.workouts ?? [], [details?.workouts]);
  const weekStats = useMemo(
    () => (data ? planWeekStats(data.weeks, workouts) : []),
    [data, workouts],
  );
  const groups = useMemo(() => phaseGroups(weekStats), [weekStats]);
  const startDate =
    (details?.startDate ?? data?.plan.startDate)?.slice(0, 10) ?? null;

  const [selectedWeek, setSelectedWeek] = useState<PlanWeekView | null>(null);
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
      // The plan in progress keeps its actions here; creating a plan is the first of them.
      rightAction: isActive ? (
        <HeaderActionButton
          accessibilityLabel={copy.plans.card.moreActions}
          icon={
            <MoreHorizontal
              color={theme.color.foreground}
              size={20}
              strokeWidth={2.2}
            />
          }
          onPress={() => setActionsOpen(true)}
          theme={theme}
          themeMode={themeMode}
        />
      ) : (
        <HeaderPlusButton
          onPress={navigation.openCreationMethod}
          theme={theme}
          themeMode={themeMode}
        />
      ),
      variant: "default",
      bottomContent: null,
      tone: isActive ? "surface" : "screen",
    },
    [
      logoSource,
      copy.plans.tab.openPlans,
      copy.plans.tab.plansButton,
      copy.plans.card.moreActions,
      navigation,
      isActive,
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
  const addWorkoutTo = (week: PlanWeekView): (() => void) | undefined => {
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

  const selectWeek = (weekNumber: number) =>
    setSelectedWeek(
      weeks.find((week) => week.weekNumber === weekNumber) ?? null,
    );

  const handleRefresh = () => {
    setPulling(true);
    void Promise.allSettled([refresh(), countsQuery.refetch()]).finally(() =>
      setPulling(false),
    );
  };

  const currentStats = weekStats.find((week) => week.status === "current");
  const currentDays =
    startDate && data && currentStats
      ? weekDays(weekStartDate(startDate, currentStats.weekNumber), workouts)
      : [];
  const workoutTypeLabels = copy.plan.creation.workoutTypes as Record<
    string,
    string | undefined
  >;
  const todayEvents: DayEvent[] = workoutsOn(workouts).map((workout) => ({
    id: workout.id,
    type: workout.type === "recovery" ? "recovery" : "workout",
    status: toDayEventStatus(workout.status),
    title:
      workoutTargetText(workout.target, "title") ||
      workoutTypeLabels[workout.type] ||
      workout.type,
    typeLabel: workoutTypeLabels[workout.type],
    dateLabel: `${copy.today.today} · ${formatDateLong(new Date(), language)}`,
    intensity: workoutIntensity(workout.type),
    duration: format.minutes(Math.round(workout.durationMinutes)),
    distance: format.distance(workout.distanceKm),
  }));
  const coachChange = latestAdaptation(data?.adaptations ?? []);

  const goal = data?.plan.goal;
  const goalValue = goal?.target?.finishTimeSec
    ? formatHoursMinutesSeconds(goal.target.finishTimeSec)
    : goal?.target?.distanceMeters
      ? format.distance(goal.target.distanceMeters / 1000)
      : null;
  const goalRow = {
    title: goalValue
      ? fillTemplate(copy.plan.screen.weeks.goal, { value: goalValue })
      : copy.plan.screen.weeks.goalFallback,
    subtitle: data
      ? [
          planTitle(data.plan, copy, language),
          goal?.targetDate
            ? formatDateLong(parseIsoDate(goal.targetDate), language)
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null,
  };

  const fullWidth = isActive || displayState === "empty";

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      refreshing={pulling}
      onRefresh={handleRefresh}
      theme={theme}
      themeMode={themeMode}
      contentStyle={fullWidth ? styles.fullWidth : undefined}
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
          onCreateWithCoach={openTrefix}
          onCreateManually={() => navigation.openCreation({ mode: "create" })}
          onOpenPlans={() => navigation.openPlans({ source: "plan_tab_empty" })}
          onOpenHistory={() =>
            navigation.openPlans({
              segment: "history",
              source: "plan_tab_empty",
            })
          }
          onStartDraft={(plan) =>
            navigation.startDraft(
              { id: plan.id, name: planTitle(plan, copy, language) },
              "plan_tab_empty",
            )
          }
          onOpenDraft={(plan) => navigation.openPlanDetails(plan.id)}
          theme={theme}
          themeMode={themeMode}
        />
      ) : displayState === "not_started" ? (
        <PlanNotStartedState
          copy={copy}
          language={language}
          onSelectWeek={setSelectedWeek}
          weeks={weeks}
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
          weeks={weeks}
          language={language}
          overview={data}
          theme={theme}
          themeMode={themeMode}
        />
      ) : (
        /* Active Plan View */
        <>
          <PlanHero
            kicker={fillTemplate(copy.plan.screen.hero.kicker, {
              current: data.plan.currentWeek,
              total: data.plan.totalWeeks,
            })}
            title={planHeading(data.plan, copy)}
            goal={data.plan.goal}
            startDate={startDate}
            totalWeeks={data.plan.totalWeeks}
            weeks={weekStats}
            theme={theme}
            copy={copy}
            language={language}
          />

          <PendingAdaptationsCard
            copy={copy}
            language={language}
            theme={theme}
            themeMode={themeMode}
          />

          {currentStats && currentDays.length > 0 ? (
            <ThisWeekCard
              week={currentStats}
              days={currentDays}
              keySessions={
                data.currentWeekContext?.keySessions.map((session) =>
                  keySessionLabel(session, copy),
                ) ?? []
              }
              theme={theme}
              copy={copy}
              language={language}
              onPress={() => selectWeek(currentStats.weekNumber)}
            />
          ) : null}

          {todayEvents.length > 0 ? (
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.plan.screen.todayTitle}
              </Text>
              {todayEvents.map((event) => (
                <WorkoutCard
                  key={event.id}
                  event={event}
                  copy={copy}
                  theme={theme}
                  themeMode={themeMode}
                  onPress={() => openWorkout(event.id)}
                />
              ))}
            </View>
          ) : null}

          {coachChange ? (
            <CoachAdaptationRow
              adaptation={coachChange}
              copy={copy}
              theme={theme}
              onPress={setSelectedAdaptation}
            />
          ) : null}

          {groups.length > 0 ? (
            <PlanPhaseWeeks
              groups={groups}
              goal={goalRow}
              theme={theme}
              copy={copy}
              language={language}
              onSelectWeek={selectWeek}
              onPressGoal={() => setActionsOpen(true)}
            />
          ) : (
            <PlanTimeline
              copy={copy}
              onSelectWeek={setSelectedWeek}
              theme={theme}
              themeMode={themeMode}
              weeks={weeks}
            />
          )}
        </>
      )}

      {/* Week Details Sheet */}
      <PlanWeekDetailsSheet
        adaptations={data?.adaptations}
        copy={copy}
        mode={displayState === "completed" ? "history" : "active"}
        week={selectedWeek}
        workouts={weekRows}
        totalWeeks={data?.plan.totalWeeks}
        weekStart={
          startDate && selectedWeek
            ? weekStartDate(startDate, selectedWeek.weekNumber)
            : null
        }
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

const styles = StyleSheet.create({
  // Blocks run edge to edge: the hero is full-bleed, cards keep their own 16 px.
  fullWidth: {
    paddingHorizontal: 0,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
});
