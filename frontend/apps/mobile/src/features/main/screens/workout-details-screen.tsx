import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarArrowUp,
  CalendarDays,
  Check,
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
import { SheetBlock, SheetButton } from "../../../shared/ui/sheet-controls";
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
import {
  SHEET_ACTION_BAR_SPACE,
  SheetActionBar,
} from "../../plans/components/plans-ui";
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
import { useUpdateWorkout, useWorkoutExecution } from "../hooks/use-workouts";
import { getErrorMessage } from "../../../shared/lib/error-message";
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

type WorkoutAction = Exclude<PlanWorkoutEditMode, "add">;
/** What opens once the sheet on screen has finished sliding away. */
type NextSheet = "menu" | WorkoutAction | "closeScreen" | null;

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
  // One sheet at a time: the open one slides away first, then the next opens.
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState<WorkoutAction | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const nextSheet = useRef<NextSheet>(null);
  const completion = useWorkoutCompletion(copy, () => completion.reset());
  const updateWorkout = useUpdateWorkout();
  const [moveError, setMoveError] = useState<string | null>(null);

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
  // Plan workouts change through the plan; workouts added by hand directly
  // while they are planned (a missed one too: it can be moved or removed).
  const isPlanEditable = Boolean(actions?.isEditable);
  const isManualEditable = Boolean(
    workout && !workout.planId && workout.status === "planned",
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
          onPress={() => setMenuOpen(true)}
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
  const today = todayIso();
  // A workout the athlete added by hand starts only on its day: a future or a
  // missed one is moved to today first (the backend allows today and later).
  const isOwnPlanned =
    !workout.planId && workout.status === "planned" && workout.type !== "rest";
  const canMoveToToday =
    isOwnPlanned && workoutDate !== today && !recorder.active;
  const isOwnMissed = isOwnPlanned && workoutDate < today;
  const isMissed = workout.status === "skipped" || isOwnMissed;
  const moveToToday = async () => {
    setMoveError(null);
    try {
      await updateWorkout.mutateAsync({
        workoutId: workout.id,
        dto: { scheduledAt: new Date(`${today}T09:00:00.000Z`).toISOString() },
      });
    } catch (moveFailure) {
      setMoveError(
        getErrorMessage(moveFailure, copy.errors, t.moveToTodayFailed),
      );
    }
  };
  const actionNote = canMoveToToday
    ? isOwnMissed
      ? t.missedNote
      : t.futureNote
    : null;
  const isCompleting = completion.isCompleting;
  const level = workoutIntensity(workout.type);
  const typeLabel = (
    copy.plan.creation.workoutTypes as Record<string, string | undefined>
  )[workout.type];
  const title =
    workoutTargetText(workout.target, "title") || typeLabel || workout.type;
  const description = workoutTargetText(workout.target, "description");

  const isToday = workoutDate === today;
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

  const openAction = (next: WorkoutAction) => {
    nextSheet.current = next;
    setMenuOpen(false);
  };
  const onMenuClosed = () => {
    setMenuOpen(false);
    const next = nextSheet.current;
    nextSheet.current = null;
    if (next && next !== "menu" && next !== "closeScreen") {
      setAction(next);
      setActionOpen(true);
    }
  };
  const backToMenu = () => {
    nextSheet.current = "menu";
    setActionOpen(false);
  };
  const closeAction = (then: NextSheet = null) => {
    nextSheet.current = then;
    setActionOpen(false);
  };
  const onActionClosed = () => {
    setActionOpen(false);
    setAction(null);
    const next = nextSheet.current;
    nextSheet.current = null;
    if (next === "menu") setMenuOpen(true);
    if (next === "closeScreen") onBack();
  };
  const actionTitle =
    action === "move"
      ? t.sheets.moveTitle
      : action === "edit"
        ? t.sheets.editTitle
        : t.sheets.removeTitle;
  // Same cards as the plan creation method sheet: icon circle, title, one-line hint.
  const menu: Array<{
    key: WorkoutAction;
    label: string;
    hint: string;
    icon: React.ReactNode;
  }> = [
    {
      key: "move",
      label: planCopy.move,
      hint: t.menu.moveHint,
      icon: <CalendarDays size={20} color={theme.color.accent} />,
    },
    {
      key: "edit",
      label: planCopy.edit,
      hint: t.menu.editHint,
      icon: <Pencil size={20} color={theme.color.accent} />,
    },
    {
      key: "remove",
      label: planCopy.remove,
      hint: t.menu.removeHint,
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

        {!isCompleting &&
        (actions.canRecord || actions.canComplete || canMoveToToday) ? (
          <View style={styles.actions}>
            {canMoveToToday ? (
              <Pressable
                accessibilityRole="button"
                disabled={updateWorkout.isPending}
                onPress={() => void moveToToday()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.color.primary },
                  updateWorkout.isPending && styles.busy,
                  pressed && styles.pressed,
                ]}
              >
                <CalendarArrowUp
                  size={20}
                  color={theme.color.primaryForeground}
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
                  {t.moveToToday}
                </Text>
              </Pressable>
            ) : null}
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
                  actions.canRecord || canMoveToToday
                    ? styles.roundButton
                    : styles.wideButton,
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
                {actions.canRecord || canMoveToToday ? null : (
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

        {actionNote && !isCompleting ? (
          <Text style={[styles.note, muted]}>{actionNote}</Text>
        ) : null}

        {moveError ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: theme.color.dangerSurface },
            ]}
          >
            <Text style={[styles.body, { color: theme.color.danger }]}>
              {moveError}
            </Text>
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
        visible={menuOpen}
        animatedHide
        onClose={onMenuClosed}
        theme={theme}
        themeMode={themeMode}
        title={t.menu.title}
      >
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuContent}
          showsVerticalScrollIndicator={false}
        >
          <SheetBlock theme={theme}>
            <View style={styles.menuCards}>
              {menu.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  onPress={() => openAction(item.key)}
                  style={({ pressed }) => [
                    styles.menuCard,
                    // `control` equals the sheet colour on dark; one step off the sheet reads on both themes.
                    { backgroundColor: theme.color.secondary },
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      { backgroundColor: theme.color.sheet },
                    ]}
                  >
                    {item.icon}
                  </View>
                  <View style={styles.menuText}>
                    <Text
                      style={[
                        styles.menuTitle,
                        {
                          color: theme.color.foreground,
                          fontFamily: theme.typography.fontFamily.sans.medium,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={[styles.menuHint, muted]}>{item.hint}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </SheetBlock>
        </ScrollView>
        <SheetActionBar theme={theme}>
          <SheetButton
            label={planCopy.cancel}
            onPress={() => setMenuOpen(false)}
            variant="secondary"
            theme={theme}
            themeMode={themeMode}
          />
        </SheetActionBar>
      </BottomSheet>

      <BottomSheet
        visible={actionOpen}
        animatedHide
        onClose={onActionClosed}
        theme={theme}
        themeMode={themeMode}
        title={actionTitle}
      >
        {action && isManualEditable ? (
          <ManualWorkoutEditPanel
            mode={action}
            workout={{
              id: workout.id,
              type: workout.type,
              distanceKm: workout.distanceKm,
              durationMinutes: workout.durationMinutes,
              scheduledAt: workout.scheduledAt,
            }}
            onDone={(removed) => closeAction(removed ? "closeScreen" : null)}
            onBack={backToMenu}
            onCancel={() => closeAction()}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        ) : null}
        {action && isPlanEditable && activePlanId ? (
          <PlanWorkoutEditPanel
            planId={activePlanId}
            mode={action}
            workout={{
              id: workout.id,
              type: workout.type,
              distanceKm: workout.distanceKm,
              durationMinutes: workout.durationMinutes,
              scheduledAt: workout.scheduledAt,
            }}
            onDone={() =>
              closeAction(action === "remove" ? "closeScreen" : null)
            }
            onCancel={backToMenu}
            onDismiss={() => closeAction()}
            removeBody={t.sheets.removeBody}
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
  busy: {
    opacity: 0.7,
  },
  note: {
    marginTop: -16,
    paddingHorizontal: 16,
    fontSize: 13,
    lineHeight: 18,
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
  // Sheet content starts under the floating sheet header, like plansUiStyles.sheetContent.
  menuScroll: {
    width: "100%",
  },
  menuContent: {
    gap: 16,
    paddingTop: 72,
    paddingBottom: SHEET_ACTION_BAR_SPACE,
  },
  menuCards: {
    gap: 8,
  },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 24,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  menuHint: {
    fontSize: 13,
    lineHeight: 18,
  },
});
