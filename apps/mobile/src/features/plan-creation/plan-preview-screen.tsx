import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AlertCircle, ChevronLeft, ChevronRight, X } from "lucide-react-native";

import {
  type ManualPlanNewWorkout,
  type ManualPlanPreview,
  type ManualPlanPreviewWorkout,
  type ManualPlanWorkoutOverride,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../locales";
import { BottomSheet, SheetBlock, SheetButton } from "../../shared/ui/bottom-sheet";
import { Card } from "../../shared/ui/card";
import { Ruler } from "@workspace/ui-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  PLAN_WORKOUT_TYPE_KEYS,
  formatGoalSummary,
  type PlanCreationDraft,
} from "./plan-creation-types";
import { useCreateManualPlan } from "./hooks/use-manual-plan";
import { DayPicker, FieldError, OptionChip, SectionBlock } from "./components/plan-creation-ui";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  preview: ManualPlanPreview;
  draft: PlanCreationDraft;
  onEditSettings: () => void;
  onDiscard: () => void;
  onCreated: () => void;
};

type EditingTarget = {
  weekNumber: number;
  workout: ManualPlanPreviewWorkout | null;
  /** Suggested weekday for a new workout: first free training day of the week. */
  defaultDayOfWeek?: number;
};

type WorkoutChanges = {
  type?: string;
  dayOfWeek?: number;
  distanceKm?: number;
  durationMinutes?: number;
};

/** Client-side addition. `localId` keeps it addressable for edit/remove before creation. */
type PlanAddition = ManualPlanNewWorkout & { weekNumber: number; localId: string };

const NEW_WORKOUT_ID_PREFIX = "new:";

const isAdditionId = (id: string) => id.startsWith(NEW_WORKOUT_ID_PREFIX);

/** Distance is shown and compared with 0.1 km precision. */
const roundKm = (value: number) => Math.round(value * 10) / 10;

/** Parses user input like "7.5" / "7,5"; empty → null, garbage → NaN. */
function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return null;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Mirrors backend engine rules; returns an errors-copy key or null. */
function validateWorkoutChanges(changes: WorkoutChanges): string | null {
  if (
    changes.distanceKm !== undefined &&
    (!Number.isFinite(changes.distanceKm) || changes.distanceKm <= 0 || changes.distanceKm > 100)
  ) {
    return "invalidDistance";
  }
  if (
    changes.durationMinutes !== undefined &&
    (!Number.isFinite(changes.durationMinutes) ||
      changes.durationMinutes < 10 ||
      changes.durationMinutes > 300)
  ) {
    return "invalidDuration";
  }
  return null;
}

const SHORT_DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SHORT_DAY_NAMES_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function PlanPreviewScreen({
  theme,
  themeMode,
  copy,
  language,
  preview,
  draft,
  onCreated,
  onEditSettings,
  onDiscard,
}: Props) {
  const creationCopy = copy.plan.creation;
  const previewCopy = creationCopy.preview;
  const regular = theme.typography.fontFamily.sans.regular;
  const medium = theme.typography.fontFamily.sans.medium;
  const semibold = theme.typography.fontFamily.sans.semibold;

  const [overrides, setOverrides] = useState<Record<string, ManualPlanWorkoutOverride>>({});
  const [removals, setRemovals] = useState<Array<{ weekNumber: number; orderInWeek: number }>>([]);
  const [additions, setAdditions] = useState<PlanAddition[]>([]);
  const additionSeq = useRef(0);
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  /**
   * Sheet visibility is separate from `editing`: closing first slides the sheet
   * down (animatedHide) with its content still rendered; `editing` is cleared
   * only once the animation has finished (BottomSheet onClose).
   */
  const [editorOpen, setEditorOpen] = useState(false);
  const closeEditor = () => setEditorOpen(false);
  const openEditor = (target: EditingTarget) => {
    setEditing(target);
    setEditorOpen(true);
  };
  const [editError, setEditError] = useState<string | null>(null);
  const [showCreatedError, setShowCreatedError] = useState(false);

  const createMutation = useCreateManualPlan();

  const shortDayNames = language === "ru" ? SHORT_DAY_NAMES_RU : SHORT_DAY_NAMES_EN;

  const formattedStartDate = useMemo(() => {
    return new Date(preview.startDate).toLocaleDateString(language === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "long",
    });
  }, [preview.startDate, language]);

  const goalSummary = useMemo(() => {
    return formatGoalSummary(draft.goal, copy, language === "ru" ? "ru-RU" : "en-US");
  }, [draft.goal, copy]);

  const buildCreatePayload = () => {
    const weekOverrideMap = new Map<
      number,
      {
        weekNumber: number;
        workoutOverrides: ManualPlanWorkoutOverride[];
        removedWorkoutIds: string[];
        newWorkouts: ManualPlanNewWorkout[];
      }
    >();
    const weekFor = (weekNumber: number) => {
      let entry = weekOverrideMap.get(weekNumber);
      if (!entry) {
        entry = { weekNumber, workoutOverrides: [], removedWorkoutIds: [], newWorkouts: [] };
        weekOverrideMap.set(weekNumber, entry);
      }
      return entry;
    };

    for (const override of Object.values(overrides)) {
      weekFor(Number(override.id.split("-")[0])).workoutOverrides.push(override);
    }
    for (const removal of removals) {
      weekFor(removal.weekNumber).removedWorkoutIds.push(`${removal.weekNumber}-${removal.orderInWeek}`);
    }
    for (const addition of additions) {
      // Additions are sent as newWorkouts only; their local ids never reach the backend.
      weekFor(addition.weekNumber).newWorkouts.push({
        type: addition.type,
        dayOfWeek: addition.dayOfWeek,
        distanceKm: addition.distanceKm,
        durationMinutes: addition.durationMinutes,
      });
    }

    return {
      goal: {
        type: draft.goal.type,
        target: draft.goal.target,
        current: draft.goal.current,
        description: draft.goal.description,
        targetDate: draft.goal.targetDate,
        priority: draft.goal.priority,
        raceDistance: draft.goal.raceDistance,
        targetTimeSeconds: draft.goal.targetTimeSeconds,
      },
      schedule: draft.schedule,
      structure: {
        ...draft.structure,
        focus: draft.structure.focus,
      },
      startDate: preview.startDate,
      weekOverrides: weekOverrideMap.size ? Array.from(weekOverrideMap.values()) : undefined,
    };
  };

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(buildCreatePayload());
      // PRD section 16: navigate the user back to the existing Plan screen.
      onCreated();
    } catch {
      setShowCreatedError(true);
    }
  };

  const applyEdit = (
    target: EditingTarget & { workout: ManualPlanPreviewWorkout },
    changes: WorkoutChanges,
  ) => {
    // Client-side mirror of the backend engine rules. The server re-validates
    // everything on creation, so a stale edit cannot produce an invalid plan.
    const error = validateWorkoutChanges(changes);
    if (error) {
      setEditError(error);
      return;
    }
    setEditError(null);

    const workoutId = target.workout.id;
    if (isAdditionId(workoutId)) {
      const localId = workoutId.slice(NEW_WORKOUT_ID_PREFIX.length);
      setAdditions((current) =>
        current.map((addition) =>
          addition.localId === localId
            ? {
                ...addition,
                type: changes.type ?? addition.type,
                dayOfWeek: changes.dayOfWeek ?? addition.dayOfWeek,
                distanceKm: changes.distanceKm ?? addition.distanceKm,
                durationMinutes: changes.durationMinutes ?? addition.durationMinutes,
              }
            : addition,
        ),
      );
      closeEditor();
      return;
    }

    setOverrides((current) => ({
      ...current,
      [workoutId]: {
        ...current[workoutId],
        id: workoutId,
        ...changes,
      },
    }));
    closeEditor();
  };

  const removeWorkout = (workout: ManualPlanPreviewWorkout) => {
    if (isAdditionId(workout.id)) {
      const localId = workout.id.slice(NEW_WORKOUT_ID_PREFIX.length);
      setAdditions((current) => current.filter((addition) => addition.localId !== localId));
      closeEditor();
      return;
    }

    setRemovals((current) =>
      current.some(
        (item) => item.weekNumber === workout.weekNumber && item.orderInWeek === workout.orderInWeek,
      )
        ? current
        : [...current, { weekNumber: workout.weekNumber, orderInWeek: workout.orderInWeek }],
    );
    setOverrides((current) => {
      const next = { ...current };
      delete next[workout.id];
      return next;
    });
    closeEditor();
  };

  const addWorkout = (input: Omit<PlanAddition, "localId">): boolean => {
    const error = validateWorkoutChanges(input);
    if (error) {
      setEditError(error);
      return false;
    }
    setEditError(null);
    additionSeq.current += 1;
    const localId = String(additionSeq.current);
    setAdditions((current) => [...current, { ...input, localId }]);
    return true;
  };

  const resolvedWorkouts = new Map<string, ManualPlanPreviewWorkout>();
  for (const week of preview.weeks) {
    for (const workout of week.workouts) {
      const isRemoved = removals.some(
        (item) => item.weekNumber === workout.weekNumber && item.orderInWeek === workout.orderInWeek,
      );
      if (isRemoved) {
        continue;
      }
      const override = overrides[workout.id];
      resolvedWorkouts.set(workout.id, override ? { ...workout, ...override } : workout);
    }
  }

  const additionsByWeek = new Map<number, ManualPlanPreviewWorkout[]>();
  additions.forEach((addition, index) => {
    const list = additionsByWeek.get(addition.weekNumber) ?? [];
    list.push({
      id: `${NEW_WORKOUT_ID_PREFIX}${addition.localId}`,
      type: addition.type,
      phase: "",
      weekNumber: addition.weekNumber,
      dayOfWeek: addition.dayOfWeek,
      scheduledAt: "",
      orderInWeek: 1000 + index,
      durationMinutes: addition.durationMinutes ?? 30,
      distanceKm: addition.distanceKm ?? 0,
      target: {},
      steps: [],
    });
    additionsByWeek.set(addition.weekNumber, list);
  });

  // Reflects the user's edits, removals and additions, not the raw preview.
  const totalDistance =
    Array.from(resolvedWorkouts.values()).reduce((sum, workout) => sum + workout.distanceKm, 0) +
    Array.from(additionsByWeek.values())
      .flat()
      .reduce((sum, workout) => sum + workout.distanceKm, 0);

  const renderWorkout = (workout: ManualPlanPreviewWorkout, index: number) => {
    const typeLabel =
      creationCopy.workoutTypes[workout.type as keyof typeof creationCopy.workoutTypes] ??
      workout.type;
    const isEdited = overrides[workout.id] !== undefined || isAdditionId(workout.id);
    const distanceLabel = `${roundKm(workout.distanceKm)} ${creationCopy.units.km}`;
    const meta = [distanceLabel, `${workout.durationMinutes} ${creationCopy.units.min}`];
    if (isEdited) meta.push(previewCopy.edited);

    return (
      <Pressable
        key={workout.id}
        accessibilityRole="button"
        accessibilityLabel={`${shortDayNames[workout.dayOfWeek]}, ${typeLabel}, ${meta.join(", ")}`}
        onPress={() => {
          setEditError(null);
          openEditor({
            weekNumber: workout.weekNumber,
            workout: isAdditionId(workout.id) ? workout : resolvedWorkouts.get(workout.id) ?? workout,
          });
        }}
        style={({ pressed }) => [
          styles.workoutRow,
          index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
          pressed && styles.rowPressed,
        ]}
      >
        <Text style={[styles.workoutDay, { color: theme.color.mutedForeground, fontFamily: medium }]}>
          {shortDayNames[workout.dayOfWeek]}
        </Text>
        <View style={styles.workoutTextGroup}>
          <Text style={[styles.workoutType, { color: theme.color.foreground, fontFamily: medium }]}>
            {typeLabel}
          </Text>
          <Text style={[styles.workoutMeta, { color: theme.color.mutedForeground, fontFamily: regular }]}>
            {meta.join(" · ")}
          </Text>
        </View>
        <ChevronRight color={theme.color.mutedForeground} size={18} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={creationCopy.common.back}
          hitSlop={8}
          onPress={onEditSettings}
          style={({ pressed }) => [styles.headerButton, pressed && styles.rowPressed]}
        >
          <ChevronLeft color={theme.color.foreground} size={24} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.color.foreground, fontFamily: semibold }]}>
          {previewCopy.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={creationCopy.common.close}
          hitSlop={8}
          onPress={onDiscard}
          style={({ pressed }) => [styles.headerButton, pressed && styles.rowPressed]}
        >
          <X color={theme.color.mutedForeground} size={20} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageHint, { color: theme.color.mutedForeground, fontFamily: regular }]}>
          {previewCopy.hint}
        </Text>

        {/* Plan summary */}
        <Card size="sm" theme={theme} themeMode={themeMode} style={styles.summaryCard}>
          <Text style={[styles.summaryTitle, { color: theme.color.foreground, fontFamily: semibold }]}>
            {goalSummary}
          </Text>
          <View style={styles.summaryStats}>
            {[
              { value: String(preview.totalWeeks), label: previewCopy.statWeeks },
              { value: String(preview.trainingFrequency), label: previewCopy.statRuns },
              { value: `${Math.round(totalDistance)}`, label: previewCopy.statDistance },
            ].map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.color.foreground, fontFamily: semibold }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: theme.color.mutedForeground, fontFamily: regular }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.summaryMeta, { color: theme.color.mutedForeground, fontFamily: regular }]}>
            {previewCopy.startsOn.replace("{{date}}", formattedStartDate)}
          </Text>
        </Card>

        {/* Weeks */}
        {preview.weeks.map((week) => {
          const phaseKey = String(week.phase).toUpperCase() as keyof typeof previewCopy.phases;
          const phaseLabel = previewCopy.phases[phaseKey] ?? week.phase;
          // Backend titles are English placeholders; the title is derived from the phase here.
          const weekTitle = previewCopy.phaseTitles[phaseKey] ?? week.title;
          const baseWeekWorkouts = week.workouts
            .map((workout) => resolvedWorkouts.get(workout.id))
            .filter((workout): workout is ManualPlanPreviewWorkout => workout !== undefined);
          const weekWorkouts = [...baseWeekWorkouts, ...(additionsByWeek.get(week.weekNumber) ?? [])].sort(
            (left, right) => left.dayOfWeek - right.dayOfWeek,
          );
          const weekDistance = weekWorkouts.reduce((sum, workout) => sum + workout.distanceKm, 0);
          const occupiedDays = new Set(weekWorkouts.map((workout) => workout.dayOfWeek));
          const freeDay =
            draft.schedule.trainingDays.find((day) => !occupiedDays.has(day)) ??
            [0, 1, 2, 3, 4, 5, 6].find((day) => !occupiedDays.has(day)) ??
            draft.schedule.trainingDays[0] ??
            0;

          return (
            <Card key={week.weekNumber} size="sm" theme={theme} themeMode={themeMode} style={styles.weekCard}>
              <View style={styles.weekHeader}>
                <Text style={[styles.weekLabel, { color: theme.color.mutedForeground, fontFamily: medium }]}>
                  {previewCopy.weekLabel.replace("{{number}}", String(week.weekNumber))} · {phaseLabel}
                </Text>
                <Text style={[styles.weekTitle, { color: theme.color.foreground, fontFamily: semibold }]}>
                  {weekTitle}
                </Text>
                <Text style={[styles.weekMeta, { color: theme.color.mutedForeground, fontFamily: regular }]}>
                  {previewCopy.weekSummary
                    .replace("{{workouts}}", String(weekWorkouts.length))
                    .replace("{{distance}}", String(Math.round(weekDistance)))}
                </Text>
              </View>

              <View style={[styles.workoutList, { borderTopColor: theme.color.border }]}>
                {weekWorkouts.map(renderWorkout)}
              </View>

              <SheetButton
                label={creationCopy.workoutEditor.addButton}
                variant="secondary"
                onPress={() => {
                  setEditError(null);
                  openEditor({ weekNumber: week.weekNumber, workout: null, defaultDayOfWeek: freeDay });
                }}
                theme={theme}
                themeMode={themeMode}
                style={styles.addButton}
              />
            </Card>
          );
        })}
      </ScrollView>

      {/* Footer: floating button pair without a bar, like the dialog actions */}
      <View style={styles.footer} pointerEvents="box-none">
        {showCreatedError ? (
          <View style={styles.inlineErrorRow}>
            <AlertCircle color="#dc2626" size={14} />
            <Text style={[styles.inlineErrorText, { fontFamily: regular }]}>
              {creationCopy.errors.creationFailed}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void handleCreate()}>
              <Text style={[styles.inlineErrorRetry, { fontFamily: semibold }]}>
                {creationCopy.errors.tryAgain}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.footerButtons}>
          <SheetButton
            label={creationCopy.common.cancel}
            onPress={onDiscard}
            variant="secondary"
            disabled={createMutation.isPending}
            theme={theme}
            themeMode={themeMode}
          />
          <SheetButton
            label={previewCopy.createButton}
            onPress={() => void handleCreate()}
            pending={createMutation.isPending}
            theme={theme}
            themeMode={themeMode}
          />
        </View>
      </View>

      {/* Workout edit sheet */}
      <BottomSheet
        visible={editorOpen}
        animatedHide
        onClose={() => {
          // Called after the slide-down finished (or after a drag/backdrop close).
          setEditorOpen(false);
          setEditing(null);
        }}
        theme={theme}
        themeMode={themeMode}
        title={creationCopy.workoutEditor.title}
      >

        {editing && editing.workout ? (
          <WorkoutEditForm
            key={editing.workout.id}
            workout={editing.workout}
            theme={theme}
            copy={copy}
            language={language}
            themeMode={themeMode}
            error={editError}
            onSave={(changes) => {
              const current = editing;
              if (!current?.workout) return;
              applyEdit({ weekNumber: current.weekNumber, workout: current.workout }, changes);
            }}
            onRemove={() => {
              const current = editing;
              if (current?.workout) removeWorkout(current.workout);
            }}
            onClose={closeEditor}
          />
        ) : null}

        {editing && !editing.workout ? (
          <WorkoutEditForm
            workout={null}
            defaultDayOfWeek={editing.defaultDayOfWeek}
            theme={theme}
            copy={copy}
            language={language}
            themeMode={themeMode}
            error={editError}
            onSave={(changes) => {
              if (!editing) return;
              const added = addWorkout({
                type: changes.type ?? "easy",
                dayOfWeek: changes.dayOfWeek ?? editing.defaultDayOfWeek ?? 0,
                distanceKm: changes.distanceKm,
                durationMinutes: changes.durationMinutes ?? 30,
                weekNumber: editing.weekNumber,
              });
              // Keep the sheet open on validation errors so the inline error is visible.
              if (added) closeEditor();
            }}
            onClose={closeEditor}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

type WorkoutEditFormProps = {
  workout: ManualPlanPreviewWorkout | null;
  defaultDayOfWeek?: number;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  error: string | null;
  onSave: (changes: WorkoutChanges) => void;
  onRemove?: () => void;
  onClose: () => void;
};

/**
 * Workout editor in the creation-flow style: type slider, weekday row and
 * rulers for distance and duration. Actions mirror the creation steps:
 * back icon (closes) | Delete | Save (only once something changed).
 * Only changed fields are sent as overrides; a new workout sends everything.
 */
function WorkoutEditForm({
  workout,
  defaultDayOfWeek,
  theme,
  themeMode,
  copy,
  language,
  error,
  onSave,
  onRemove,
  onClose,
}: WorkoutEditFormProps) {
  const creationCopy = copy.plan.creation;
  const editorCopy = creationCopy.workoutEditor;
  const shortDayNames = language === "ru" ? SHORT_DAY_NAMES_RU : SHORT_DAY_NAMES_EN;

  const initial = {
    type: workout?.type ?? "easy",
    dayOfWeek: workout?.dayOfWeek ?? defaultDayOfWeek ?? 0,
    distanceKm: workout ? roundKm(workout.distanceKm) : 5,
    durationMinutes: workout?.durationMinutes ?? 30,
  };
  const [type, setType] = useState(initial.type);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek);
  const [distanceKm, setDistanceKm] = useState(initial.distanceKm);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);

  const changes: WorkoutChanges = workout
    ? {
        type: type !== initial.type ? type : undefined,
        dayOfWeek: dayOfWeek !== initial.dayOfWeek ? dayOfWeek : undefined,
        distanceKm: Math.abs(distanceKm - initial.distanceKm) > 1e-6 ? distanceKm : undefined,
        durationMinutes: durationMinutes !== initial.durationMinutes ? durationMinutes : undefined,
      }
    : { type, dayOfWeek, distanceKm, durationMinutes };
  const hasChanges = !workout || Object.values(changes).some((value) => value !== undefined);

  return (
    <>
      {/* Same structure as WorkoutGoalSheet: plain ScrollView sized by content
          (the sheet caps it at 85%), actions pinned to the sheet bottom. */}
      <ScrollView
        style={styles.editScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.editContent}
      >
        {/* Title only: the slider below runs edge to edge, outside the padded block. */}
        <SectionBlock title={editorCopy.typeLabel} theme={theme}>
          {null}
        </SectionBlock>
        {/* Type slider: one horizontal row edge to edge, like the presets in the workout sheet. */}
        <SheetBlock theme={theme} edgeToEdge>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeSlider}
            style={styles.typeSliderView}
          >
            {PLAN_WORKOUT_TYPE_KEYS.map((typeKey) => (
              <OptionChip
                key={typeKey}
                label={creationCopy.workoutTypes[typeKey as keyof typeof creationCopy.workoutTypes] ?? typeKey}
                selected={type === typeKey}
                theme={theme}
                themeMode={themeMode}
                onPress={() => setType(typeKey)}
              />
            ))}
          </ScrollView>
        </SheetBlock>

        <SectionBlock title={editorCopy.dayLabel} theme={theme}>
          <DayPicker
            selectedDays={[dayOfWeek]}
            shortDayNames={shortDayNames}
            onToggleDay={setDayOfWeek}
            theme={theme}
            themeMode={themeMode}
          />
        </SectionBlock>

        <SectionBlock title={editorCopy.distanceLabel} theme={theme}>
          <Ruler
            value={distanceKm}
            onChange={setDistanceKm}
            min={0.5}
            max={100}
            step={0.1}
            majorEvery={1}
            labelEvery={1}
            tickSpacing={10}
            unit={creationCopy.units.km}
            accessibilityLabel={editorCopy.distanceLabel}
            theme={theme}
            themeMode={themeMode}
          />
        </SectionBlock>

        <SectionBlock title={editorCopy.durationLabel} theme={theme}>
          <Ruler
            value={durationMinutes}
            onChange={setDurationMinutes}
            min={10}
            max={300}
            step={5}
            majorEvery={15}
            labelEvery={30}
            unit={creationCopy.units.min}
            accessibilityLabel={editorCopy.durationLabel}
            theme={theme}
            themeMode={themeMode}
          />
        </SectionBlock>

        {error ? (
          <SheetBlock theme={theme}>
            <FieldError
              message={creationCopy.errors[error as keyof typeof creationCopy.errors] ?? error}
              theme={theme}
            />
          </SheetBlock>
        ) : null}
      </ScrollView>

      {/* Actions: same layout and offsets as the creation-step sheets. */}
      <SheetBlock theme={theme}>
        <View style={styles.editActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={creationCopy.common.back}
          onPress={onClose}
          style={({ pressed }) => [
            styles.editIconButton,
            { backgroundColor: theme.color.controlSecondary },
            pressed && styles.rowPressed,
          ]}
        >
          <ChevronLeft color={theme.color.foreground} size={22} />
        </Pressable>
        {workout && onRemove ? (
          <SplitActions
            showSecond={hasChanges}
            first={{ label: editorCopy.removeButton, onPress: onRemove }}
            second={{ label: editorCopy.save, onPress: () => onSave(changes) }}
            theme={theme}
            themeMode={themeMode}
          />
        ) : (
          <SheetButton
            label={editorCopy.addShort}
            onPress={() => onSave(changes)}
            theme={theme}
            themeMode={themeMode}
          />
        )}
        </View>
      </SheetBlock>
    </>
  );
}

const SPLIT_GAP = 12;
/** Slightly under-damped so the new button "pours out" with a small overshoot. */
const SPLIT_SPRING = { damping: 14, stiffness: 170, mass: 0.9 } as const;

/**
 * Two actions that grow out of one: the destructive button first fills the
 * row; when `showSecond` turns on, a drop of the same colour buds off its
 * right edge, swells to half the row while changing to the primary colour,
 * and its label fades in. Turning it off pours it back.
 */
function SplitActions({
  showSecond,
  first,
  second,
  theme,
  themeMode,
}: {
  showSecond: boolean;
  first: { label: string; onPress: () => void };
  second: { label: string; onPress: () => void };
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  const progress = useSharedValue(showSecond ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(showSecond ? 1 : 0, SPLIT_SPRING);
  }, [progress, showSecond]);

  const secondSlotStyle = useAnimatedStyle(() => {
    const p = Math.max(0, progress.value);
    return {
      flexGrow: p,
      marginLeft: Math.min(1, p) * SPLIT_GAP,
      // a round droplet first, then a pill
      transform: [{ scaleY: interpolate(p, [0, 0.25, 1], [0.55, 0.9, 1], Extrapolation.CLAMP) }],
      backgroundColor: interpolateColor(
        Math.min(1, p),
        [0, 0.55, 1],
        [theme.color.dangerSurface, theme.color.dangerSurface, theme.color.primary],
      ),
    };
  });

  const secondLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0.55, 1], [0.9, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.splitRow}>
      <SheetButton
        label={first.label}
        onPress={first.onPress}
        variant="destructive"
        theme={theme}
        themeMode={themeMode}
        style={styles.splitFirst}
      />
      <Animated.View
        style={[styles.splitSecond, secondSlotStyle]}
        pointerEvents={showSecond ? "auto" : "none"}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityElementsHidden={!showSecond}
          importantForAccessibility={showSecond ? "auto" : "no-hide-descendants"}
          onPress={second.onPress}
          style={({ pressed }) => [styles.splitPressable, pressed && styles.rowPressed]}
        >
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.splitLabel,
              { color: theme.color.primaryForeground, fontFamily: theme.typography.fontFamily.sans.semibold },
              secondLabelStyle,
            ]}
          >
            {second.label}
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    // Full-screen page mounted as a flex sibling of the tab content in
    // MainTabsScreen; it must overlay the whole screen instead of sharing
    // the remaining space with it.
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    // room for the floating footer buttons
    paddingBottom: 120,
    gap: 16,
  },
  pageHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  summaryCard: {
    alignItems: "center",
    borderRadius: 32,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  summaryStats: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 17,
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  weekCard: {
    gap: 8,
    borderRadius: 32,
    padding: 20,
  },
  weekHeader: {
    gap: 2,
  },
  weekLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  weekTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  weekMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  workoutList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  workoutDay: {
    width: 28,
    fontSize: 13,
    lineHeight: 18,
  },
  workoutTextGroup: {
    flex: 1,
    gap: 2,
  },
  workoutType: {
    fontSize: 14,
    lineHeight: 19,
  },
  workoutMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
  },
  footerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  inlineErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineErrorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
  },
  inlineErrorRetry: {
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
  },
  editScroll: {
    width: "100%",
  },
  // Same offsets as the creation-step sheets (header overlay on top, actions at the bottom).
  editContent: {
    gap: 28,
    paddingTop: 72,
    // room for the pinned action row (same as WorkoutGoalSheet)
    paddingBottom: 84,
  },
  typeSliderView: {
    width: "100%",
    maxHeight: 50,
    marginTop: -16,
  },
  typeSlider: {
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  editActions: {
    // Pinned to the sheet bottom like WorkoutGoalSheet's action row.
    flexDirection: "row",
    gap: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  splitRow: {
    flex: 1,
    flexDirection: "row",
  },
  splitFirst: {
    flex: 1,
  },
  splitSecond: {
    flexBasis: 0,
    minWidth: 0,
    height: 52,
    borderRadius: 9999,
    overflow: "hidden",
  },
  splitPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  splitLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  editIconButton: {
    width: 52,
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  addButton: {
    flex: 0,
    alignSelf: "stretch",
    marginTop: 4,
  },
  rowPressed: {
    opacity: 0.6,
  },

});
