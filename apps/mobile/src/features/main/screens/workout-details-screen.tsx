import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  CalendarDays,
  Check,
  Clock,
  Pencil,
  Play,
  Trash2,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  formatDayMonth,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { workoutTargetText } from "../../../shared/lib/workout-target";
import { BottomSheet } from "../../../shared/ui/bottom-sheet";
import { Card } from "../../../shared/ui/card";
import { SheetButton } from "../../../shared/ui/sheet-controls";
import { SectionCaption } from "../../plans/components/plans-ui";
import {
  PlanWorkoutEditPanel,
  type PlanWorkoutEditMode,
} from "../../plans/components/plan-workout-edit-panel";
import { useActivePlan } from "../../plans/hooks/use-active-plan";
import { useWorkout } from "../../plans/hooks/use-workout";
import {
  parseIsoDate,
  todayIso,
  workoutLocalDate,
} from "../../plans/lib/plan-dates";
import { usePreferences } from "../../profile/hooks/use-preferences";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { planRows } from "../../tracker/plan-format";
import { recorder } from "../../tracker/recorder";
import { WorkoutCoachNote } from "../../trefix/components/workout-coach-note";
import { HeaderBackButton, HeaderLogo } from "../components/header";
import { SectionLayout } from "../components/section-layout";
import {
  WorkoutCompletionForm,
  WorkoutResultSection,
} from "../components/today/workout-detail-sections";
import { useHeaderOptions } from "../context/header-context";
import { useWorkoutCompletion } from "../hooks/use-workout-completion";
import { useWorkoutExecution } from "../hooks/use-workouts";
import { getWorkoutActions } from "../lib/workout-detail-rules";
import { pushSubScreen } from "../main-routes";

type Props = {
  workoutId: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

/** One workout on its own screen: what, when, how it's built, and what to do with it. */
export function WorkoutDetailsScreen({
  workoutId,
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const workoutQuery = useWorkout(workoutId);
  const workout = workoutQuery.data ?? null;
  const activePlanQuery = useActivePlan({ enabled: Boolean(workout?.planId) });
  const format = useUnitFormat(copy, language);
  const { preferences } = usePreferences();
  const [editMode, setEditMode] = useState<PlanWorkoutEditMode | null>(null);
  const completion = useWorkoutCompletion(copy, () => completion.reset());

  const t = copy.today.details;
  const planCopy = copy.plans.edit;
  const paceUnit =
    format.units === "imperial" ? format.labels.perMi : format.labels.perKm;

  const hasSession =
    Boolean(workout) &&
    workout?.status !== "completed" &&
    workout?.type !== "rest";
  const execution = useWorkoutExecution(workout?.id ?? null, hasSession);
  const sessionRows = useMemo(
    () =>
      execution.data
        ? planRows(execution.data.steps, copy.tracker, format.units, paceUnit)
        : [],
    [copy.tracker, execution.data, format.units, paceUnit],
  );

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
          onPress={onBack}
        />
      ),
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: null,
      variant: "default",
      bottomContent: null,
    },
    [logoSource, theme, themeMode, onBack],
  );

  // A removed workout is gone: nothing left to show here.
  useEffect(() => {
    if (workoutQuery.isError) onBack();
  }, [onBack, workoutQuery.isError]);

  if (!workout) {
    return (
      <SectionLayout
        hasHeader={false}
        scrollable
        theme={theme}
        themeMode={themeMode}
      >
        {null}
      </SectionLayout>
    );
  }

  const workoutDate = workoutLocalDate(workout.scheduledAt);
  const activePlanId = activePlanQuery.data?.plan?.id ?? null;
  const actions = getWorkoutActions(
    workout,
    workoutDate,
    todayIso(),
    activePlanId,
    Boolean(recorder.active),
  );
  const isCompleting = completion.isCompleting;

  const typeLabel = (
    copy.plan.creation.workoutTypes as Record<string, string | undefined>
  )[workout.type];
  const title =
    workoutTargetText(workout.target, "title") || typeLabel || workout.type;
  const description = workoutTargetText(workout.target, "description");
  const weekday =
    copy.plan.creation.datePicker.weekdays[parseIsoDate(workoutDate).getDay()];
  const dateLabel = [weekday, formatDayMonth(workoutDate, language)]
    .filter(Boolean)
    .join(", ");
  const meta = [typeLabel, format.distance(workout.distanceKm)]
    .filter(Boolean)
    .join(" · ");
  // The header shows the logo, so the plan week moves next to the date.
  const weekLabel =
    workout.planId && workout.weekNumber
      ? fillTemplate(copy.plan.creation.preview.weekLabel, {
          number: workout.weekNumber,
        })
      : null;
  const statusLabel =
    workout.status === "completed"
      ? copy.today.workout.statuses.completed
      : workout.status === "skipped"
        ? copy.today.workout.statuses.missed
        : null;

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const strong = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };

  const actionButtons: Array<{
    key: string;
    label: string;
    icon: (color: string) => ReactNode;
    primary?: boolean;
    destructive?: boolean;
    onPress: () => void;
  }> = [];
  if (actions.canRecord) {
    actionButtons.push({
      key: "start",
      label: t.start,
      primary: true,
      icon: (color) => <Play size={20} color={color} fill={color} />,
      onPress: () =>
        pushSubScreen({ kind: "tracker-setup", plannedWorkoutId: workout.id }),
    });
  }
  if (actions.canComplete) {
    actionButtons.push({
      key: "complete",
      label: t.complete,
      icon: (color) => <Check size={20} color={color} strokeWidth={2.5} />,
      onPress: () => completion.start(workout),
    });
  }
  if (actions.isEditable) {
    actionButtons.push(
      {
        key: "edit",
        label: planCopy.edit,
        icon: (color) => <Pencil size={20} color={color} />,
        onPress: () => setEditMode("edit"),
      },
      {
        key: "move",
        label: planCopy.move,
        icon: (color) => <CalendarDays size={20} color={color} />,
        onPress: () => setEditMode("move"),
      },
      {
        key: "remove",
        label: planCopy.remove,
        destructive: true,
        icon: (color) => <Trash2 size={20} color={color} />,
        onPress: () => setEditMode("remove"),
      },
    );
  }

  return (
    <View style={styles.root}>
      <SectionLayout
        hasHeader={false}
        scrollable
        refreshing={workoutQuery.isRefetching}
        onRefresh={() => void workoutQuery.refetch()}
        theme={theme}
        themeMode={themeMode}
        contentStyle={styles.content}
      >
        <View style={styles.hero}>
          <Text style={[styles.date, muted, { fontFamily: strong.fontFamily }]}>
            {[dateLabel, weekLabel, statusLabel].filter(Boolean).join(" · ")}
          </Text>
          <Text style={[styles.title, strong]}>{title}</Text>
          {meta ? <Text style={[styles.meta, strong]}>{meta}</Text> : null}
          <View style={styles.durationRow}>
            <Clock size={16} color={theme.color.mutedForeground} />
            <Text style={[styles.duration, strong]}>
              {format.minutes(Math.round(workout.durationMinutes))}
            </Text>
          </View>
        </View>

        {actionButtons.length > 0 && !isCompleting ? (
          <View
            style={[styles.actions, { borderColor: theme.color.separator }]}
          >
            {actionButtons.map((action) => {
              const iconColor = action.primary
                ? theme.color.primaryForeground
                : action.destructive
                  ? theme.color.danger
                  : theme.color.foreground;
              return (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.action,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.actionCircle,
                      action.primary
                        ? { backgroundColor: theme.color.primary }
                        : {
                            backgroundColor: theme.color.control,
                            borderColor: theme.color.controlBorder,
                            borderWidth: StyleSheet.hairlineWidth,
                          },
                    ]}
                  >
                    {action.icon(iconColor)}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.actionLabel,
                      strong,
                      action.destructive && { color: theme.color.danger },
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {completion.errorMessage ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: theme.color.dangerSurface },
            ]}
          >
            <Text style={[styles.body, { color: theme.color.danger }]}>
              {completion.errorMessage}
            </Text>
          </View>
        ) : null}

        {isCompleting ? (
          <View style={styles.section}>
            <WorkoutCompletionForm
              completion={completion}
              theme={theme}
              copy={copy}
            />
            <View style={styles.completionButtons}>
              <SheetButton
                label={copy.today.goalSheet.cancel}
                variant="secondary"
                onPress={completion.reset}
                theme={theme}
                themeMode={themeMode}
              />
              <SheetButton
                label={copy.today.detailSheet.saveResultButton}
                onPress={() => void completion.save(workout.id)}
                pending={completion.isSaving}
                theme={theme}
                themeMode={themeMode}
              />
            </View>
          </View>
        ) : null}

        {hasSession && sessionRows.length > 0 ? (
          <View style={styles.section}>
            <SectionCaption text={t.session} theme={theme} />
            <Card size="sm" theme={theme} themeMode={themeMode}>
              {sessionRows.map((row, index) => (
                <View
                  key={row.key}
                  style={[
                    styles.stepRow,
                    index > 0 && {
                      borderTopColor: theme.color.separator,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      paddingTop: 12,
                    },
                  ]}
                >
                  <Text style={[styles.stepIndex, muted]}>{index + 1}</Text>
                  <View style={styles.stepText}>
                    <Text style={[styles.stepLabel, muted]}>{row.label}</Text>
                    <Text style={[styles.stepDetail, strong]}>
                      {row.detail}
                    </Text>
                    {row.pace ? (
                      <Text style={[styles.stepLabel, muted]}>{row.pace}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {description ? (
          <View style={styles.section}>
            <SectionCaption text={t.description} theme={theme} />
            <Text
              style={[styles.body, strong, { fontFamily: muted.fontFamily }]}
            >
              {description}
            </Text>
          </View>
        ) : null}

        {workout.type !== "rest" ? (
          <WorkoutCoachNote
            workoutId={workout.id}
            enabled={preferences.coachEnabled}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
          />
        ) : null}

        {actions.isLocked || actions.isCancelled ? (
          <Text style={[styles.body, muted]}>
            {actions.isCancelled ? planCopy.cancelledWorkout : planCopy.locked}
          </Text>
        ) : null}

        {actions.isCompleted ? (
          <WorkoutResultSection
            workout={workout}
            actualData={(workout.actual as Record<string, unknown>) || {}}
            analysisData={workout.analysis}
            theme={theme}
            copy={copy}
            format={format}
          />
        ) : null}
      </SectionLayout>

      <BottomSheet
        visible={Boolean(editMode && activePlanId)}
        onClose={() => setEditMode(null)}
        theme={theme}
        themeMode={themeMode}
        title={title}
      >
        {editMode && activePlanId ? (
          <PlanWorkoutEditPanel
            planId={activePlanId}
            mode={editMode}
            workout={{
              id: workout.id,
              type: workout.type,
              distanceKm: workout.distanceKm,
              durationMinutes: workout.durationMinutes,
              scheduledAt: workout.scheduledAt,
            }}
            onDone={() => {
              const removed = editMode === "remove";
              setEditMode(null);
              if (removed) onBack();
            }}
            onCancel={() => setEditMode(null)}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 24,
    paddingBottom: 48,
  },
  hero: {
    gap: 6,
    paddingTop: 8,
  },
  date: {
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  meta: {
    fontSize: 15,
    lineHeight: 20,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  duration: {
    fontSize: 15,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  action: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  section: {
    gap: 10,
  },
  completionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  errorBanner: {
    borderRadius: 16,
    padding: 12,
  },
  stepRow: {
    flexDirection: "row",
    gap: 14,
  },
  stepIndex: {
    width: 16,
    fontSize: 15,
    lineHeight: 20,
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  stepDetail: {
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
});
