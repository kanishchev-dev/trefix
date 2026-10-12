import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type PlanDetails, type PlanWeek } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  formatDayMonth,
  formatShortDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { Card } from "../../../shared/ui/card";
import {
  HeaderBackButton,
  HeaderOptionsButton,
  HeaderTitle,
} from "../../main/components/header";
import { SectionLayout } from "../../main/components/section-layout";
import { useHeaderOptions } from "../../main/context/header-context";
import { PlanErrorState } from "../../plan/components/plan-error-state";
import { PlanSkeleton } from "../../plan/components/plan-skeleton";
import { PlanTimeline } from "../../plan/components/plan-timeline";
import { PlanWeekDetailsSheet } from "../../plan/components/plan-week-details-sheet";
import { formatTargetTime } from "../../plan-creation/plan-creation-types";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import { MetricsSnapshotCard } from "../components/metrics-snapshot-card";
import { PlanCardActionsSheet } from "../components/plan-card-actions-sheet";
import { PlanMetaEditor } from "../components/plan-meta-editor";
import { PlanWorkoutSheet } from "../components/plan-workout-sheet";
import {
  Notice,
  plansUiStyles,
  ProgressBar,
  SectionCaption,
} from "../components/plans-ui";
import { usePlanDetails } from "../hooks/use-plan";
import { completionPercent } from "../lib/plan-card-format";
import { mondayBasedWeekday, workoutLocalDate } from "../lib/plan-dates";
import { isNotFound } from "../lib/plan-errors";
import {
  planWeeksForTimeline,
  weekWorkoutRows,
  type PlanTimelineMode,
} from "../lib/plan-weeks";
import { usePlansNavigation } from "../plans-navigation";

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
  const [selectedWeek, setSelectedWeek] = useState<PlanWeek | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);

  const isDraft = details?.status === "draft";
  const mode: PlanTimelineMode = isDraft ? "relative" : "history";
  const dayNames = shortDayNamesFor(language);

  useEffect(() => {
    if (details?.status === "active") navigation.openPlanTab();
  }, [details?.status, navigation]);

  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={navigation.back}
        />
      ),
      centerContent: (
        <HeaderTitle theme={theme}>
          {details?.name ?? plansCopy.title}
        </HeaderTitle>
      ),
      rightAction: details ? (
        <HeaderOptionsButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => setActionsOpen(true)}
        />
      ) : null,
      variant: "default",
      bottomContent: null,
    },
    [details?.name, details?.id, theme, themeMode],
  );

  const weeks = useMemo(
    () => (details ? planWeeksForTimeline(details, copy, mode) : []),
    [copy, details, mode],
  );

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

  const bodyStyle = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const mutedStyle = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };

  return (
    <View style={styles.root}>
      <SectionLayout
        hasHeader={false}
        scrollable
        refreshing={detailsQuery.isRefetching}
        onRefresh={() => void detailsQuery.refetch()}
        theme={theme}
        themeMode={themeMode}
        contentStyle={styles.content}
      >
        {!isDraft ? (
          <ResultCard
            details={details}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        ) : null}

        <Card size="sm" theme={theme} themeMode={themeMode} style={styles.card}>
          <SectionCaption text={plansCopy.details.goal} theme={theme} />
          <Text
            style={[
              styles.cardTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {[details.goal.title, raceResult(details, copy)]
              .filter(Boolean)
              .join(" · ") || details.name}
          </Text>
          {details.goal.targetDate ? (
            <Text style={[styles.cardText, mutedStyle]}>
              {fillTemplate(plansCopy.details.raceOn, {
                date: formatShortDate(details.goal.targetDate, language),
              })}
            </Text>
          ) : null}
          <Text style={[styles.cardText, mutedStyle]}>
            {structureLine(details, copy, dayNames)}
          </Text>
        </Card>

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

        {isDraft && details.metricsStale ? (
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
        ) : null}

        <PlanTimeline
          copy={copy}
          mode={mode}
          onSelectWeek={setSelectedWeek}
          theme={theme}
          themeMode={themeMode}
          weeks={weeks}
        />

        <Card size="sm" theme={theme} themeMode={themeMode} style={styles.card}>
          <View style={styles.notesHeader}>
            <SectionCaption text={plansCopy.details.notes} theme={theme} />
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setMetaOpen(true)}
            >
              <Text
                style={[
                  styles.cardText,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.semibold,
                  },
                ]}
              >
                {plansCopy.details.editNotes}
              </Text>
            </Pressable>
          </View>
          <Text
            style={[styles.cardText, details.notes ? bodyStyle : mutedStyle]}
          >
            {details.notes || plansCopy.details.notesEmpty}
          </Text>
        </Card>
      </SectionLayout>

      <View
        style={[styles.sticky, { bottom: insets.bottom + 92 }]}
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
                  { id: details.id, name: details.name },
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
        visible={selectedWeek !== null}
        onClose={() => setSelectedWeek(null)}
        onSelectWorkout={isDraft ? undefined : setWorkoutId}
        theme={theme}
        themeMode={themeMode}
      />

      <PlanWorkoutSheet
        workoutId={workoutId}
        onClose={() => setWorkoutId(null)}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
        language={language}
      />

      <PlanCardActionsSheet
        plan={{ id: details.id, name: details.name, status: details.status }}
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

function ResultCard({
  details,
  theme,
  themeMode,
  copy,
  language,
}: {
  details: PlanDetails;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
}) {
  const detailsCopy = copy.plans.details;
  const completed = details.status === "completed";
  const stats = details.stats;
  const end = completed
    ? details.endDate
    : (details.cancelledAt ?? details.endDate);
  const range =
    details.startDate && end
      ? `${formatShortDate(details.startDate, language)}–${formatShortDate(end.slice(0, 10), language)}`
      : null;
  const parts = [
    completed ? detailsCopy.resultCompleted : detailsCopy.resultCancelled,
    range,
    stats
      ? fillTemplate(detailsCopy.workoutsDone, {
          done: stats.completedWorkouts,
          total: stats.plannedWorkouts,
        })
      : null,
    stats
      ? fillTemplate(detailsCopy.totalKm, {
          km: Math.round(stats.totalDistanceKm),
        })
      : null,
  ].filter(Boolean);
  const percent = completionPercent(stats?.completionRate);

  return (
    <Card size="sm" theme={theme} themeMode={themeMode} style={styles.card}>
      <Text
        style={[
          styles.cardTitle,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {parts.join(" · ")}
      </Text>
      {stats ? (
        <ProgressBar
          value={percent / 100}
          accessibilityLabel={fillTemplate(copy.plans.card.progressA11y, {
            percent,
          })}
          theme={theme}
        />
      ) : null}
    </Card>
  );
}

/** Finish time of the completed race workout, when there is one. */
function raceResult(details: PlanDetails, copy: MainCopy): string | null {
  const race = details.workouts.find(
    (workout) => workout.type === "race" && workout.status === "completed",
  );
  const minutes = Number(
    (race?.actual as Record<string, unknown> | null)?.actualDurationMinutes ??
      0,
  );
  if (!minutes) return null;
  return fillTemplate(copy.plans.details.raceResult, {
    time: formatTargetTime(Math.round(minutes * 60)),
  });
}

function structureLine(
  details: PlanDetails,
  copy: MainCopy,
  dayNames: readonly string[],
): string {
  const schedule = details.config.schedule;
  const parts = [
    fillTemplate(copy.plans.details.structure, {
      weeks: details.totalWeeks,
      sessions: details.sessionsPerWeek ?? schedule.trainingDays?.length ?? 0,
    }),
  ];
  if (schedule.trainingDays?.length)
    parts.push(schedule.trainingDays.map((day) => dayNames[day]).join(" "));
  if (
    schedule.preferredLongRunDay !== null &&
    schedule.preferredLongRunDay !== undefined
  ) {
    parts.push(
      fillTemplate(copy.plans.details.longRun, {
        day: dayNames[schedule.preferredLongRunDay] ?? "",
      }),
    );
  }
  return parts.join(" · ");
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: 16,
    // room for the sticky action above the tab bar
    paddingBottom: 220,
  },
  card: {
    gap: 6,
    borderRadius: 28,
    padding: 18,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
