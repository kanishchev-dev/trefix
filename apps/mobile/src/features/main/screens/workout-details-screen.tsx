import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Check, Pencil, Play, Trash2 } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  formatDayMonth,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { workoutTargetText } from "../../../shared/lib/workout-target";
import { BottomSheet } from "../../../shared/ui/bottom-sheet";
import { SheetButton } from "../../../shared/ui/sheet-controls";
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
import { recorder } from "../../tracker/recorder";
import { WorkoutCoachNote } from "../../trefix/components/workout-coach-note";
import {
  HeaderBackButton,
  HeaderLogo,
  HeaderOptionsButton,
} from "../components/header";
import { IntensityScale } from "../components/intensity-scale";
import { SectionLayout } from "../components/section-layout";
import { StatusBox } from "../components/today/day-event-cards";
import {
  WorkoutCompletionForm,
  WorkoutResultSection,
} from "../components/today/workout-detail-sections";
import { ManualWorkoutEditPanel } from "../components/workout-details/manual-workout-edit-panel";
import { WorkoutStructure } from "../components/workout-details/workout-structure";
import { useHeaderOptions } from "../context/header-context";
import { useWorkoutCompletion } from "../hooks/use-workout-completion";
import { useWorkoutExecution } from "../hooks/use-workouts";
import { getWorkoutActions } from "../lib/workout-detail-rules";
import { workoutIntensity } from "../lib/workout-intensity";
import { pushSubScreen } from "../main-routes";

/** Same offset SectionLayout leaves for the floating header. */
const HEADER_OFFSET = 78;

type Props = {
  workoutId: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

type SheetState = "menu" | PlanWorkoutEditMode | null;

/**
 * One workout on its own screen. The top block is open (no card) and carries
 * the intensity scale; below it the actions, the session, the coach's note and,
 * once done, the result.
 */
export function WorkoutDetailsScreen({
  workoutId,
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const workoutQuery = useWorkout(workoutId);
  const workout = workoutQuery.data ?? null;
  const activePlanQuery = useActivePlan({ enabled: Boolean(workout?.planId) });
  const format = useUnitFormat(copy, language);
  const { preferences } = usePreferences();
  const [sheet, setSheet] = useState<SheetState>(null);
  const completion = useWorkoutCompletion(copy, () => completion.reset());

  const t = copy.today.details;
  const planCopy = copy.plans.edit;
  const workoutDate = workout ? workoutLocalDate(workout.scheduledAt) : "";
  const activePlanId = activePlanQuery.data?.plan?.id ?? null;
  const actions = workout
    ? getWorkoutActions(
        workout,
        workoutDate,
        todayIso(),
        activePlanId,
        Boolean(recorder.active),
      )
    : null;
  // Plan workouts change through the plan; workouts added by hand directly,
  // while they are planned for a future day (the backend applies the same rule).
  const isPlanEditable = Boolean(actions?.isEditable);
  const isManualEditable = Boolean(
    workout &&
      !workout.planId &&
      workout.status === "planned" &&
      workoutDate > todayIso(),
  );
  const isEditable = isPlanEditable || isManualEditable;

  const hasSession = Boolean(
    workout && workout.status !== "completed" && workout.type !== "rest",
  );
  const execution = useWorkoutExecution(workout?.id ?? null, hasSession);

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
      rightAction: isEditable ? (
        <HeaderOptionsButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => setSheet("menu")}
        />
      ) : null,
      variant: "default",
      bottomContent: null,
      tone: "surface",
    },
    [logoSource, theme, themeMode, onBack, isEditable],
  );

  // A removed workout is gone: nothing left to show here.
  useEffect(() => {
    if (workoutQuery.isError) onBack();
  }, [onBack, workoutQuery.isError]);

  if (!workout || !actions) {
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

  const isCompleted = actions.isCompleted;
  const isMissed = workout.status === "skipped";
  const isCompleting = completion.isCompleting;
  const level = workoutIntensity(workout.type);
  const typeLabel = (
    copy.plan.creation.workoutTypes as Record<string, string | undefined>
  )[workout.type];
  const title =
    workoutTargetText(workout.target, "title") || typeLabel || workout.type;
  const description = workoutTargetText(workout.target, "description");

  const isToday = workoutDate === todayIso();
  const dateLabel = isToday
    ? copy.today.today
    : [
        copy.plan.creation.datePicker.weekdays[
          parseIsoDate(workoutDate).getDay()
        ],
        formatDayMonth(workoutDate, language),
      ].join(", ");
  const weekLabel =
    workout.planId && workout.weekNumber
      ? fillTemplate(copy.plan.creation.preview.weekLabel, {
          number: workout.weekNumber,
        }).toLowerCase()
      : null;
  const statusLabel = isCompleted
    ? copy.today.workout.statuses.completed
    : isMissed
      ? copy.today.workout.statuses.missed
      : null;
  const kicker = [dateLabel, weekLabel, statusLabel]
    .filter(Boolean)
    .join(" · ");

  // Done: the hero shows what was run, the plan moves to the line below.
  const actual = (workout.actual as Record<string, unknown> | null) ?? {};
  const actualDistance = Number(actual.actualDistanceKm) || null;
  const actualMinutes = Number(actual.actualDurationMinutes) || null;
  const plannedDistance = format.distance(workout.distanceKm);
  const plannedDuration = format.minutes(Math.round(workout.durationMinutes));
  const value =
    isCompleted && actualDistance
      ? format.distance(actualDistance)
      : plannedDistance;
  const duration =
    isCompleted && actualMinutes
      ? format.minutes(Math.round(actualMinutes))
      : plannedDuration;
  const meta = [
    typeLabel,
    copy.today.workout.intensity[level],
    isCompleted && (actualDistance || actualMinutes)
      ? fillTemplate(t.planned, {
          distance: plannedDistance,
          duration: plannedDuration,
        })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const strong = {
    color: isMissed ? theme.color.mutedForeground : theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };
  const headerSpace = insets.top + HEADER_OFFSET;
  const startWorkout = () =>
    pushSubScreen({ kind: "tracker-setup", plannedWorkoutId: workout.id });

  const closeSheet = () => setSheet(null);
  const editMode = sheet && sheet !== "menu" ? sheet : null;
  const menu: Array<{
    key: PlanWorkoutEditMode;
    label: string;
    icon: React.ReactNode;
    destructive?: boolean;
  }> = [
    {
      key: "move",
      label: planCopy.move,
      icon: <CalendarDays size={20} color={theme.color.foreground} />,
    },
    {
      key: "edit",
      label: planCopy.edit,
      icon: <Pencil size={20} color={theme.color.foreground} />,
    },
    {
      key: "remove",
      label: planCopy.remove,
      destructive: true,
      icon: <Trash2 size={20} color={theme.color.danger} />,
    },
  ];

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
        {/* Open top block: card-coloured from the screen top to the divider under it. */}
        <View
          style={[
            styles.hero,
            {
              marginTop: -headerSpace,
              paddingTop: headerSpace + 8,
              backgroundColor: theme.color.card,
              borderBottomColor: theme.color.cardBorder,
            },
          ]}
        >
          <IntensityScale
            theme={theme}
            level={level}
            size="hero"
            dimmed={isMissed}
          />
          <View style={styles.heroTop}>
            <Text
              style={[styles.kicker, muted, { fontFamily: strong.fontFamily }]}
            >
              {kicker}
            </Text>
            <StatusBox
              theme={theme}
              status={
                isCompleted ? "completed" : isMissed ? "missed" : "planned"
              }
              label={statusLabel ?? copy.today.workout.statuses.planned}
            />
          </View>
          <Text accessibilityRole="header" style={[styles.title, strong]}>
            {title}
          </Text>
          <View style={styles.volume}>
            <Text style={[styles.value, strong]}>{value}</Text>
            <Text style={[styles.duration, muted]}>{duration}</Text>
          </View>
          <Text style={[styles.meta, muted]}>{meta}</Text>
        </View>

        {!isCompleting && (actions.canRecord || actions.canComplete) ? (
          <View style={styles.actions}>
            {actions.canRecord ? (
              <Pressable
                accessibilityRole="button"
                onPress={startWorkout}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.color.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Play
                  size={18}
                  color={theme.color.primaryForeground}
                  fill={theme.color.primaryForeground}
                />
                <Text
                  style={[
                    styles.primaryLabel,
                    {
                      color: theme.color.primaryForeground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {t.start}
                </Text>
              </Pressable>
            ) : null}
            {actions.canComplete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.markDone}
                onPress={() => completion.start(workout)}
                style={({ pressed }) => [
                  actions.canRecord ? styles.roundButton : styles.wideButton,
                  {
                    backgroundColor: theme.color.control,
                    borderColor: theme.color.controlBorder,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Check
                  size={20}
                  strokeWidth={2.4}
                  color={theme.color.foreground}
                />
                {actions.canRecord ? null : (
                  <Text
                    style={[
                      styles.primaryLabel,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.medium,
                      },
                    ]}
                  >
                    {t.markDone}
                  </Text>
                )}
              </Pressable>
            ) : null}
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

        {isCompleted ? (
          <WorkoutResultSection
            workout={workout}
            actualData={actual}
            analysisData={workout.analysis}
            theme={theme}
            copy={copy}
            format={format}
          />
        ) : null}

        {hasSession && execution.data && execution.data.steps.length > 0 ? (
          <WorkoutStructure
            execution={execution.data}
            level={level}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            format={format}
          />
        ) : null}

        {description ? (
          <View style={styles.section}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, strong]}
            >
              {t.description}
            </Text>
            <Text
              style={[
                styles.body,
                { color: theme.color.foreground, fontFamily: muted.fontFamily },
              ]}
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
      </SectionLayout>

      <BottomSheet
        visible={sheet !== null && (isManualEditable || Boolean(activePlanId))}
        onClose={closeSheet}
        theme={theme}
        themeMode={themeMode}
        title={title}
      >
        {sheet === "menu" ? (
          <View>
            {menu.map((item, index) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => setSheet(item.key)}
                style={({ pressed }) => [
                  styles.menuRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.color.separator,
                  },
                  pressed && styles.pressed,
                ]}
              >
                {item.icon}
                <Text
                  style={[
                    styles.menuLabel,
                    {
                      color: item.destructive
                        ? theme.color.danger
                        : theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {editMode && editMode !== "add" && isManualEditable ? (
          <ManualWorkoutEditPanel
            mode={editMode}
            workout={{
              id: workout.id,
              type: workout.type,
              distanceKm: workout.distanceKm,
              durationMinutes: workout.durationMinutes,
              scheduledAt: workout.scheduledAt,
            }}
            onDone={(removed) => {
              closeSheet();
              if (removed) onBack();
            }}
            onCancel={() => setSheet("menu")}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        ) : null}
        {editMode && isPlanEditable && activePlanId ? (
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
              closeSheet();
              if (editMode === "remove") onBack();
            }}
            onCancel={() => setSheet("menu")}
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
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingBottom: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    marginTop: 8,
    maxWidth: 250,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  volume: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  value: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  duration: {
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  meta: {
    marginTop: 8,
    maxWidth: 230,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  roundButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  wideButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryLabel: {
    fontSize: 16,
    lineHeight: 20,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  completionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  errorBanner: {
    borderRadius: 16,
    padding: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  menuLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
});
