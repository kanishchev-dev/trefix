import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlertCircle, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react-native";

import {
  type ManualPlanPreview,
  type ManualPlanPreviewWorkout,
  type PlanDiff,
  type PlanStartBlock,
  type PlanStartOptions,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, formatDayMonth, type AppLanguage, type MainCopy } from "../../locales";
import { BottomSheet, SheetButton } from "../../shared/ui/bottom-sheet";
import { Card } from "../../shared/ui/card";
import { PlanDiffSummaryCard } from "../plans/components/plan-diff-summary-card";
import { PlanMetaSheet } from "../plans/components/plan-meta-sheet";
import { StartPlanSheet, type StartSheetResult } from "../plans/components/start-plan-sheet";
import { planErrorMessage } from "../plans/lib/plan-errors";
import { type CreationDecision } from "../plans/lib/start-plan";
import { formatGoalSummary, type PlanCreationDraft } from "./plan-creation-types";
import {
  EMPTY_PREVIEW_EDITS,
  hasPreviewEdits,
  type PlanAddition,
  type PreviewEdits,
} from "./preview-edits";
import {
  WorkoutEditForm,
  roundKm,
  shortDayNamesFor,
  validateWorkoutChanges,
  type WorkoutChanges,
} from "./components/workout-edit-form";

/**
 * `creation` — new manual plan; `rebuild` — "prepare again" from a history
 * plan; `draft-edit` — workouts of a stored draft; `draft-params` — a draft
 * regenerated from new parameters.
 */
export type PlanPreviewMode = "creation" | "rebuild" | "draft-edit" | "draft-params";

/** Server diff against the source plan (rebuild and draft parameters). */
export type PreviewDiffInfo = {
  mode: "rebased" | "regenerated";
  diff: PlanDiff;
  warnings: string[];
  metricsVolume?: { before?: number | null; after?: number | null };
};

export type PreviewSubmission = {
  edits: PreviewEdits;
  name?: string;
  notes?: string | null;
  /** Creation modes only: save as a draft or start right away. */
  decision?: CreationDecision;
};

export type PreviewOutcome = StartSheetResult | "saved";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  mode?: PlanPreviewMode;
  preview: ManualPlanPreview;
  draft: PlanCreationDraft;
  diffInfo?: PreviewDiffInfo | null;
  startOptions?: PlanStartOptions | null;
  initialName?: string;
  initialNotes?: string | null;
  /** Back to the parameter steps; hidden when there are none (draft workouts editing). */
  onEditSettings?: () => void;
  onDiscard: () => void;
  onSubmit: (submission: PreviewSubmission) => Promise<void>;
  /** Fired after the final sheet has closed. */
  onCompleted: (outcome: PreviewOutcome) => void;
};

type EditingTarget = {
  weekNumber: number;
  workout: ManualPlanPreviewWorkout | null;
  /** Suggested weekday for a new workout: first free training day of the week. */
  defaultDayOfWeek?: number;
};

const NEW_WORKOUT_ID_PREFIX = "new:";

const isAdditionId = (id: string) => id.startsWith(NEW_WORKOUT_ID_PREFIX);

export function PlanPreviewScreen({
  theme,
  themeMode,
  copy,
  language,
  mode = "creation",
  preview,
  draft,
  diffInfo,
  startOptions,
  initialName,
  initialNotes,
  onEditSettings,
  onDiscard,
  onSubmit,
  onCompleted,
}: Props) {
  const creationCopy = copy.plan.creation;
  const previewCopy = creationCopy.preview;
  const plansPreviewCopy = copy.plans.preview;
  const regular = theme.typography.fontFamily.sans.regular;
  const medium = theme.typography.fontFamily.sans.medium;
  const semibold = theme.typography.fontFamily.sans.semibold;
  const isCreation = mode === "creation" || mode === "rebuild";

  const [edits, setEdits] = useState<PreviewEdits>(EMPTY_PREVIEW_EDITS);
  const { overrides, removals, additions } = edits;
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startSheetVisible, setStartSheetVisible] = useState(false);
  const [metaSheetVisible, setMetaSheetVisible] = useState(false);

  const shortDayNames = shortDayNamesFor(language);

  const goalSummary = useMemo(() => {
    return formatGoalSummary(draft.goal, copy, language === "ru" ? "ru-RU" : "en-US");
  }, [draft.goal, copy, language]);

  const [name, setName] = useState(initialName ?? goalSummary);
  const [notes, setNotes] = useState<string | null>(initialNotes ?? null);

  const diffByKey = useMemo(() => {
    const map = new Map<string, PlanDiff["weeks"][number]["workouts"][number]>();
    for (const week of diffInfo?.diff.weeks ?? []) {
      for (const workout of week.workouts) map.set(workout.key, workout);
    }
    return map;
  }, [diffInfo]);

  const showElementDiff = diffInfo?.mode === "rebased";

  const submit = async (decision?: CreationDecision) => {
    await onSubmit({
      edits,
      name: isCreation ? name : undefined,
      notes: isCreation ? notes : undefined,
      decision,
    });
  };

  const handlePrimary = async () => {
    if (isCreation) {
      setSubmitError(null);
      setStartSheetVisible(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submit();
      onCompleted("saved");
    } catch (error) {
      setSubmitError(planErrorMessage(error, copy, creationCopy.errors.creationFailed));
    } finally {
      setSubmitting(false);
    }
  };

  const updateEdits = (updater: (current: PreviewEdits) => PreviewEdits) => setEdits(updater);

  const applyEdit = (
    target: EditingTarget & { workout: ManualPlanPreviewWorkout },
    changes: WorkoutChanges,
  ) => {
    // Client-side mirror of the backend engine rules. The server re-validates
    // everything on save, so a stale edit cannot produce an invalid plan.
    const error = validateWorkoutChanges(changes);
    if (error) {
      setEditError(error);
      return;
    }
    setEditError(null);

    const workoutId = target.workout.id;
    if (isAdditionId(workoutId)) {
      const localId = workoutId.slice(NEW_WORKOUT_ID_PREFIX.length);
      updateEdits((current) => ({
        ...current,
        additions: current.additions.map((addition) =>
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
      }));
      closeEditor();
      return;
    }

    updateEdits((current) => ({
      ...current,
      overrides: {
        ...current.overrides,
        [workoutId]: {
          ...current.overrides[workoutId],
          id: workoutId,
          weekNumber: target.weekNumber,
          ...changes,
        },
      },
    }));
    closeEditor();
  };

  const removeWorkout = (workout: ManualPlanPreviewWorkout) => {
    if (isAdditionId(workout.id)) {
      const localId = workout.id.slice(NEW_WORKOUT_ID_PREFIX.length);
      updateEdits((current) => ({
        ...current,
        additions: current.additions.filter((addition) => addition.localId !== localId),
      }));
      closeEditor();
      return;
    }

    updateEdits((current) => {
      const nextOverrides = { ...current.overrides };
      delete nextOverrides[workout.id];
      return {
        ...current,
        overrides: nextOverrides,
        removals: current.removals.some((item) => item.id === workout.id)
          ? current.removals
          : [...current.removals, { id: workout.id, weekNumber: workout.weekNumber, orderInWeek: workout.orderInWeek }],
      };
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
    updateEdits((current) => ({ ...current, additions: [...current.additions, { ...input, localId }] }));
    return true;
  };

  const resolvedWorkouts = new Map<string, ManualPlanPreviewWorkout>();
  for (const week of preview.weeks) {
    for (const workout of week.workouts) {
      if (removals.some((item) => item.id === workout.id)) {
        continue;
      }
      const override = overrides[workout.id];
      resolvedWorkouts.set(workout.id, override ? { ...workout, ...override, weekNumber: workout.weekNumber } : workout);
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
    const serverChange = showElementDiff ? diffByKey.get(workout.id) : undefined;
    const previousDistance = serverChange?.fields?.distanceKm?.[0];
    const previousDuration = serverChange?.fields?.durationMinutes?.[0];
    const distanceLabel = `${roundKm(workout.distanceKm)} ${creationCopy.units.km}`;
    const durationLabel = `${workout.durationMinutes} ${creationCopy.units.min}`;
    const meta = [distanceLabel, durationLabel];
    if (isEdited) meta.push(previewCopy.edited);
    const spokenDiff = [
      typeof previousDistance === "number"
        ? fillTemplate(copy.plans.diff.wasNow, { before: `${roundKm(previousDistance)} ${creationCopy.units.km}`, after: distanceLabel })
        : null,
      typeof previousDuration === "number"
        ? fillTemplate(copy.plans.diff.wasNow, { before: `${previousDuration} ${creationCopy.units.min}`, after: durationLabel })
        : null,
      serverChange?.change === "added" ? copy.plans.diff.addedBadge : null,
    ].filter(Boolean);

    return (
      <Pressable
        key={workout.id}
        accessibilityRole="button"
        accessibilityLabel={[`${shortDayNames[workout.dayOfWeek]}, ${typeLabel}, ${meta.join(", ")}`, ...spokenDiff].join(". ")}
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
            {serverChange?.change === "added" ? (
              <Text style={{ color: theme.color.mutedForeground, fontFamily: regular }}>{` · ${copy.plans.diff.addedBadge}`}</Text>
            ) : null}
          </Text>
          <Text style={[styles.workoutMeta, { color: theme.color.mutedForeground, fontFamily: regular }]}>
            {typeof previousDistance === "number" && !isEdited ? (
              <Text style={styles.strike}>{`${roundKm(previousDistance)} ${creationCopy.units.km}`}</Text>
            ) : null}
            {typeof previousDistance === "number" && !isEdited ? " " : ""}
            {meta.join(" · ")}
          </Text>
        </View>
        <ChevronRight color={theme.color.mutedForeground} size={18} />
      </Pressable>
    );
  };

  const removedByServer = (weekNumber: number) =>
    showElementDiff
      ? diffInfo?.diff.weeks
          .find((week) => week.weekNumber === weekNumber)
          ?.workouts.filter((workout) => workout.change === "removed") ?? []
      : [];

  const headerTitle =
    mode === "draft-edit" ? plansPreviewCopy.draftEditTitle : isCreation ? name || previewCopy.title : previewCopy.title;

  const primaryLabel = isCreation ? plansPreviewCopy.saveButton : plansPreviewCopy.saveChanges;
  const startsOn = preview.startDate ? formatDayMonth(preview.startDate.slice(0, 10), language) : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <View style={styles.header}>
        {onEditSettings ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={creationCopy.common.back}
            hitSlop={8}
            onPress={onEditSettings}
            style={({ pressed }) => [styles.headerButton, pressed && styles.rowPressed]}
          >
            <ChevronLeft color={theme.color.foreground} size={24} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
        {isCreation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${headerTitle}. ${plansPreviewCopy.renameA11y}`}
            onPress={() => setMetaSheetVisible(true)}
            style={({ pressed }) => [styles.headerTitleButton, pressed && styles.rowPressed]}
          >
            <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.color.foreground, fontFamily: semibold }]}>
              {headerTitle}
            </Text>
            <Pencil color={theme.color.mutedForeground} size={14} />
          </Pressable>
        ) : (
          <Text numberOfLines={1} style={[styles.headerTitle, styles.headerTitleFill, { color: theme.color.foreground, fontFamily: semibold }]}>
            {headerTitle}
          </Text>
        )}
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
          {mode === "draft-edit" ? plansPreviewCopy.draftHint : previewCopy.hint}
        </Text>

        {diffInfo ? (
          <PlanDiffSummaryCard
            diff={diffInfo.diff}
            mode={diffInfo.mode}
            warnings={diffInfo.warnings}
            metricsVolume={diffInfo.metricsVolume}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        ) : null}

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
          {startsOn ? (
            <Text style={[styles.summaryMeta, { color: theme.color.mutedForeground, fontFamily: regular }]}>
              {fillTemplate(previewCopy.startsOn, { date: startsOn })}
            </Text>
          ) : null}
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
          const serverRemoved = removedByServer(week.weekNumber);

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
                {serverRemoved.map((workout) => (
                  <Text
                    key={`removed-${workout.key}`}
                    accessibilityLabel={copy.plans.diff.removedBadge}
                    style={[styles.removedRow, { color: theme.color.mutedForeground, fontFamily: regular }]}
                  >
                    {`− ${copy.plans.diff.removedBadge}`}
                  </Text>
                ))}
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
        {submitError ? (
          <View style={styles.inlineErrorRow}>
            <AlertCircle color="#dc2626" size={14} />
            <Text style={[styles.inlineErrorText, { fontFamily: regular }]}>{submitError}</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void handlePrimary()}>
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
            disabled={submitting}
            theme={theme}
            themeMode={themeMode}
          />
          <SheetButton
            label={primaryLabel}
            onPress={() => void handlePrimary()}
            pending={submitting}
            disabled={mode === "draft-edit" && !hasPreviewEdits(edits)}
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

      {isCreation ? (
        <StartPlanSheet
          visible={startSheetVisible}
          mode="creation"
          planName={name}
          options={startOptions ?? preview.startOptions ?? null}
          entry={mode === "rebuild" ? "rebuild" : "creation"}
          onStart={(start: PlanStartBlock) => submit({ kind: "start", start })}
          onSaveDraft={() => submit({ kind: "draft" })}
          onClose={(result) => {
            setStartSheetVisible(false);
            if (result) onCompleted(result);
          }}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
        />
      ) : null}

      {isCreation ? (
        <PlanMetaSheet
          visible={metaSheetVisible}
          initialName={name}
          initialNotes={notes}
          onSubmit={(values) => {
            setName(values.name);
            setNotes(values.notes);
          }}
          onClose={() => setMetaSheetVisible(false)}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
        />
      ) : null}
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
  headerTitleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  headerTitleFill: {
    flex: 1,
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
  // Same offsets as the creation-step sheets (header overlay on top, actions at the bottom).
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
  strike: {
    textDecorationLine: "line-through",
  },
  removedRow: {
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 8,
    textDecorationLine: "line-through",
  },

});
