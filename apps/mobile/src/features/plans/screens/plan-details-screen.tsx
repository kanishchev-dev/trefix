import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type PlanDetails } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { formatHoursMinutesSeconds } from "@trefix/utils";

import {
  fillTemplate,
  formatDateLong,
  formatDayMonth,
  formatShortDate,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import {
  HeaderBackButton,
  HeaderLogo,
  HeaderOptionsButton,
} from "../../main/components/header";
import { SectionLayout } from "../../main/components/section-layout";
import { FADE_EXTRA, SHELL_HEIGHT } from "../../main/components/tab-bar.styles";
import { BottomFade } from "../../../shared/ui/bottom-fade";
import { pushSubScreen } from "../../main/main-routes";
import { useHeaderOptions } from "../../main/context/header-context";
import { PlanErrorState } from "../../plan/components/plan-error-state";
import { PlanSkeleton } from "../../plan/components/plan-skeleton";
import { PlanHero } from "../../plan/components/plan-hero";
import { PlanPhaseWeeks } from "../../plan/components/plan-phase-weeks";
import { PlanWeekDetailsSheet } from "../../plan/components/plan-week-details-sheet";
import { StatTiles, type StatTile } from "../../plan/components/stat-tiles";
import {
  detailsWeekStats,
  phaseGroups,
  weekStartDate,
} from "../../plan/lib/active-plan-view";
import { distanceNumber } from "../../plan/lib/distance-text";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { formatTargetTime } from "../../plan-creation/plan-creation-types";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import { MetricsSnapshotCard } from "../components/metrics-snapshot-card";
import { PlanCardActionsSheet } from "../components/plan-card-actions-sheet";
import { PlanMetaEditor } from "../components/plan-meta-editor";
import { Notice, plansUiStyles } from "../components/plans-ui";
import { usePlanDetails } from "../hooks/use-plan";
import { completionPercent } from "../lib/plan-card-format";
import {
  mondayBasedWeekday,
  parseIsoDate,
  workoutLocalDate,
} from "../lib/plan-dates";
import { isNotFound } from "../lib/plan-errors";
import { goalTitle, planHeading, planTitle } from "../lib/plan-texts";
import {
  planWeeksForTimeline,
  weekWorkoutRows,
  type PlanTimelineMode,
  type PlanWeekView,
} from "../lib/plan-weeks";
import { usePlansNavigation } from "../plans-navigation";

/** Height of the sticky primary button. */
const ACTION_HEIGHT = 52;

type Props = {
  planId: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Details of a draft or a history plan; the plan in progress lives on the Plan tab. */
export function PlanDetailsScreen({
  planId,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const plansCopy = copy.plans;
  const navigation = usePlansNavigation();
  const insets = useSafeAreaInsets();
  const detailsQuery = usePlanDetails(planId);
  const details = detailsQuery.data;
  const [selectedWeek, setSelectedWeek] = useState<PlanWeekView | null>(null);
  // The week sheet is a modal: close it first, or it would cover the pushed screen.
  const openWorkout = useCallback((workoutId: string) => {
    setSelectedWeek(null);
    pushSubScreen({ kind: "workout-details", workoutId });
  }, []);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  // Only the user's pull shows the spinner; background refetches stay silent.
  const [pulling, setPulling] = useState(false);

  const isDraft = details?.status === "draft";
  const mode: PlanTimelineMode = isDraft ? "relative" : "history";
  const dayNames = shortDayNamesFor(language);

  useEffect(() => {
    if (details?.status === "active") navigation.openPlanTab();
  }, [details?.status, navigation]);

  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={navigation.back}
        />
      ),
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: details ? (
        <HeaderOptionsButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => setActionsOpen(true)}
        />
      ) : null,
      variant: "default",
      bottomContent: null,
      tone: details ? "surface" : "screen",
    },
    [details?.id, logoSource, theme, themeMode],
  );

  const weeks = useMemo(
    () => (details ? planWeeksForTimeline(details, copy, mode) : []),
    [copy, details, mode],
  );

  const weekStats = useMemo(
    () => (details ? detailsWeekStats(details, mode) : []),
    [details, mode],
  );
  const groups = useMemo(() => phaseGroups(weekStats), [weekStats]);
  const format = useUnitFormat(copy, language);

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

  if (detailsQuery.isLoading) {
    return (
      <SectionLayout
        hasHeader={false}
        scrollable
        theme={theme}
        themeMode={themeMode}
      >
        <PlanSkeleton theme={theme} themeMode={themeMode} />
      </SectionLayout>
    );
  }

  if (!details) {
    return (
      <SectionLayout
        hasHeader={false}
        scrollable
        theme={theme}
        themeMode={themeMode}
      >
        {isNotFound(detailsQuery.error) ? (
          <View style={styles.notFound}>
            <Text
              style={[
                plansUiStyles.bodyText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {plansCopy.errors.notFound}
            </Text>
            <SheetButton
              label={plansCopy.errors.back}
              variant="secondary"
              onPress={navigation.back}
              theme={theme}
              themeMode={themeMode}
              style={plansUiStyles.columnButton}
            />
          </View>
        ) : (
          <PlanErrorState
            copy={copy}
            onRetry={() => void detailsQuery.refetch()}
            theme={theme}
            themeMode={themeMode}
          />
        )}
      </SectionLayout>
    );
  }

  const actionBottom =
    Math.max(insets.bottom - 18, 4) + (SHELL_HEIGHT - ACTION_HEIGHT) / 2;
  const medium = theme.typography.fontFamily.sans.medium;
  const regular = theme.typography.fontFamily.sans.regular;
  const t = copy.plan.screen;
  const isCompleted = details.status === "completed";
  const end = isCompleted
    ? details.endDate
    : (details.cancelledAt ?? details.endDate);
  const range =
    !isDraft && details.startDate && end
      ? `${formatShortDate(details.startDate, language)}–${formatShortDate(end.slice(0, 10), language)}`
      : null;
  const statusKicker = isCompleted
    ? t.details.completedKicker
    : t.details.cancelledKicker;
  const kicker = isDraft
    ? fillTemplate(t.details.draftKicker, {
        weeks: pluralize(t.empty.weeksCount, details.totalWeeks, language),
      })
    : range
      ? fillTemplate(t.details.range, { kicker: statusKicker, range })
      : statusKicker;

  const goalValue = details.goal.target?.finishTimeSec
    ? formatHoursMinutesSeconds(details.goal.target.finishTimeSec)
    : details.goal.target?.distanceMeters
      ? format.distance(details.goal.target.distanceMeters / 1000)
      : null;
  const goalRow = {
    title: goalValue
      ? fillTemplate(t.weeks.goal, { value: goalValue })
      : t.weeks.goalFallback,
    subtitle:
      [
        goalTitle(details.goal, copy, language),
        details.goal.targetDate
          ? formatDateLong(parseIsoDate(details.goal.targetDate), language)
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
  };

  const stats = details.stats;
  const race = raceResult(details);
  const resultTiles: StatTile[] = stats
    ? [
        {
          value: fillTemplate(t.weekSheet.doneValue, {
            done: stats.completedWorkouts,
            total: stats.plannedWorkouts,
          }),
          label: t.details.resultDone,
        },
        {
          value: distanceNumber(stats.totalDistanceKm, format),
          unit:
            format.units === "imperial" ? format.labels.mi : format.labels.km,
          label: t.details.resultDistance,
        },
        race
          ? { value: race, label: t.details.resultTime }
          : {
              value: `${completionPercent(stats.completionRate)}%`,
              label: t.details.resultRate,
            },
      ]
    : [];

  return (
    <View style={styles.root}>
      <SectionLayout
        hasHeader={false}
        scrollable
        refreshing={pulling}
        onRefresh={() => {
          setPulling(true);
          void detailsQuery.refetch().finally(() => setPulling(false));
        }}
        theme={theme}
        themeMode={themeMode}
        contentStyle={styles.content}
      >
        <PlanHero
          kicker={kicker}
          title={planHeading(details, copy)}
          goal={details.goal}
          startDate={details.startDate}
          totalWeeks={details.totalWeeks}
          countdown={isDraft}
          note={scheduleLine(details, copy, language, dayNames)}
          weeks={weekStats}
          theme={theme}
          copy={copy}
          language={language}
        />
        <View style={styles.spacer} />

        {resultTiles.length > 0 ? (
          <View style={styles.inset}>
            <StatTiles tiles={resultTiles} theme={theme} tone="card" />
          </View>
        ) : null}

        {isDraft && details.metricsStale ? (
          <View style={styles.inset}>
            <Notice
              tone="warning"
              theme={theme}
              action={{
                label: plansCopy.details.staleBanner,
                onPress: () =>
                  navigation.openCreation({
                    mode: "draft-params",
                    planId: details.id,
                    initialStep: "metrics",
                  }),
              }}
            >
              {plansCopy.start.staleMetrics}
            </Notice>
          </View>
        ) : null}

        {groups.length > 0 ? (
          <PlanPhaseWeeks
            groups={groups}
            goal={goalRow}
            theme={theme}
            copy={copy}
            language={language}
            onSelectWeek={(weekNumber) =>
              setSelectedWeek(
                weeks.find((week) => week.weekNumber === weekNumber) ?? null,
              )
            }
          />
        ) : null}

        <View style={styles.section}>
          <MetricsSnapshotCard
            snapshot={details.metricsSnapshot}
            title={
              isDraft
                ? plansCopy.details.metrics
                : plansCopy.details.metricsAtStart
            }
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.notesHeader}>
            <Text
              accessibilityRole="header"
              style={[
                styles.notesTitle,
                { color: theme.color.foreground, fontFamily: medium },
              ]}
            >
              {plansCopy.details.notes}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setMetaOpen(true)}
            >
              <Text
                style={[
                  styles.notesText,
                  { color: theme.color.mutedForeground, fontFamily: medium },
                ]}
              >
                {plansCopy.details.editNotes}
              </Text>
            </Pressable>
          </View>
          <View style={[styles.notes, { backgroundColor: theme.color.card }]}>
            <Text
              style={[
                styles.notesText,
                {
                  color: details.notes
                    ? theme.color.foreground
                    : theme.color.mutedForeground,
                  fontFamily: regular,
                },
              ]}
            >
              {details.notes || plansCopy.details.notesEmpty}
            </Text>
          </View>
        </View>
      </SectionLayout>

      {/* Sits where the tab bar sits on the main screens, over the same bottom fade. */}
      <BottomFade
        height={actionBottom + ACTION_HEIGHT + FADE_EXTRA}
        theme={theme}
        themeMode={themeMode}
      />
      <View
        style={[styles.sticky, { bottom: actionBottom }]}
        pointerEvents="box-none"
      >
        <SheetButton
          label={
            isDraft
              ? plansCopy.details.startButton
              : plansCopy.details.prepareAgainButton
          }
          onPress={() =>
            isDraft
              ? navigation.startDraft(
                  { id: details.id, name: planTitle(details, copy, language) },
                  "plan_details",
                )
              : navigation.openCreation({
                  mode: "rebuild",
                  sourcePlanId: details.id,
                })
          }
          theme={theme}
          themeMode={themeMode}
          style={plansUiStyles.columnButton}
        />
      </View>

      <PlanWeekDetailsSheet
        copy={copy}
        mode={mode}
        week={selectedWeek}
        workouts={weekRows}
        totalWeeks={details.totalWeeks}
        weekStart={
          details.startDate && selectedWeek && !isDraft
            ? weekStartDate(
                details.startDate.slice(0, 10),
                selectedWeek.weekNumber,
              )
            : null
        }
        visible={selectedWeek !== null}
        onClose={() => setSelectedWeek(null)}
        onSelectWorkout={isDraft ? undefined : openWorkout}
        theme={theme}
        themeMode={themeMode}
      />

      <PlanCardActionsSheet
        plan={{
          id: details.id,
          name: planTitle(details, copy, language),
          status: details.status,
        }}
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onDeleted={navigation.back}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />

      <PlanMetaEditor
        planId={metaOpen ? details.id : null}
        visible={metaOpen}
        onClose={() => setMetaOpen(false)}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />
    </View>
  );
}

/** Finish time of the completed race workout, when there is one. */
function raceResult(details: PlanDetails): string | null {
  const race = details.workouts.find(
    (workout) => workout.type === "race" && workout.status === "completed",
  );
  const minutes = Number(
    (race?.actual as Record<string, unknown> | null)?.actualDurationMinutes ??
      0,
  );
  return minutes ? formatTargetTime(Math.round(minutes * 60)) : null;
}

/** "4 тренировки в неделю, длительная — вс". */
function scheduleLine(
  details: PlanDetails,
  copy: MainCopy,
  language: AppLanguage,
  dayNames: readonly string[],
): string | null {
  const schedule = details.config.schedule;
  const sessions = details.sessionsPerWeek ?? schedule.trainingDays?.length;
  const parts: string[] = [];
  if (sessions)
    parts.push(pluralize(copy.plans.goalTitle.runsPerWeek, sessions, language));
  const longRunDay = schedule.preferredLongRunDay;
  if (longRunDay !== null && longRunDay !== undefined && dayNames[longRunDay]) {
    parts.push(
      fillTemplate(copy.plan.screen.details.longRun, {
        day:
          language === "ru"
            ? dayNames[longRunDay].toLowerCase()
            : dayNames[longRunDay],
      }),
    );
  }
  return parts.length ? parts.join(", ") : null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Blocks run edge to edge: the hero is full-bleed, cards keep their own 16 px.
  content: {
    paddingHorizontal: 0,
    gap: 12,
    // room for the sticky action at the bottom
    paddingBottom: 140,
  },
  inset: {
    marginHorizontal: 16,
  },
  spacer: {
    height: 8,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 8,
    gap: 12,
  },
  notes: {
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notesTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  notFound: {
    gap: 16,
    paddingVertical: 48,
    alignItems: "center",
  },
  sticky: {
    position: "absolute",
    left: 16,
    right: 16,
  },
});
