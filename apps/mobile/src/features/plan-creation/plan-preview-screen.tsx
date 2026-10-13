import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";

import {
  type ManualPlanPreview,
  type ManualPlanPreviewWorkout,
  type PlanDiff,
  type PlanStartBlock,
  type PlanStartOptions,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { formatDayMonth, type AppLanguage, type MainCopy } from "../../locales";
import { BottomSheet, SheetButton } from "../../shared/ui/bottom-sheet";
import { PlanDiffSummaryCard } from "../plans/components/plan-diff-summary-card";
import { PlanMetaSheet } from "../plans/components/plan-meta-sheet";
import {
  StartPlanSheet,
  type StartSheetResult,
} from "../plans/components/start-plan-sheet";
import { planErrorMessage } from "../plans/lib/plan-errors";
import { type CreationDecision } from "../plans/lib/start-plan";
import {
  formatGoalSummary,
  type PlanCreationDraft,
} from "./plan-creation-types";
import {
  hasPreviewEdits,
  isAdditionId,
  type PreviewEdits,
} from "./preview-edits";
import { usePreviewEdits } from "./hooks/use-preview-edits";
import {
  WorkoutEditForm,
  shortDayNamesFor,
  type WorkoutChanges,
} from "./components/workout-edit-form";
import { styles } from "./plan-preview-screen.styles";
import { PreviewWorkoutRow } from "./components/preview-workout-row";
import { PreviewSummaryCard } from "./components/preview-summary-card";
import { PreviewHeader } from "./components/preview-header";
import { PreviewWeekCard } from "./components/preview-week-card";
import { buildPreviewWeek } from "./preview-week";

/**
 * `creation` — new manual plan; `rebuild` — "prepare again" from a history
 * plan; `draft-edit` — workouts of a stored draft; `draft-params` — a draft
 * regenerated from new parameters.
 */
export type PlanPreviewMode =
  | "creation"
  | "rebuild"
  | "draft-edit"
  | "draft-params";

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
  const semibold = theme.typography.fontFamily.sans.semibold;
  const isCreation = mode === "creation" || mode === "rebuild";

  const previewEdits = usePreviewEdits(preview);
  const {
    edits,
    editError,
    setEditError,
    resolvedWorkouts,
    additionsByWeek,
    totalDistance,
  } = previewEdits;
  const { overrides } = edits;
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startSheetVisible, setStartSheetVisible] = useState(false);
  const [metaSheetVisible, setMetaSheetVisible] = useState(false);

  const shortDayNames = shortDayNamesFor(language);

  const goalSummary = useMemo(() => {
    return formatGoalSummary(
      draft.goal,
      copy,
      language === "ru" ? "ru-RU" : "en-US",
    );
  }, [draft.goal, copy, language]);

  const [name, setName] = useState(initialName ?? goalSummary);
  const [notes, setNotes] = useState<string | null>(initialNotes ?? null);

  const diffByKey = useMemo(() => {
    const map = new Map<
      string,
      PlanDiff["weeks"][number]["workouts"][number]
    >();
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
      setSubmitError(
        planErrorMessage(error, copy, creationCopy.errors.creationFailed),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const applyEdit = (
    target: EditingTarget & { workout: ManualPlanPreviewWorkout },
    changes: WorkoutChanges,
  ) => {
    if (previewEdits.change(target.workout.id, target.weekNumber, changes)) {
      closeEditor();
    }
  };

  const removeWorkout = (workout: ManualPlanPreviewWorkout) => {
    previewEdits.remove(workout);
    closeEditor();
  };

  const addWorkout = previewEdits.add;

  const renderWorkout = (workout: ManualPlanPreviewWorkout, index: number) => (
    <PreviewWorkoutRow
      key={workout.id}
      workout={workout}
      index={index}
      theme={theme}
      copy={copy}
      shortDayNames={shortDayNames}
      isEdited={overrides[workout.id] !== undefined || isAdditionId(workout.id)}
      serverChange={showElementDiff ? diffByKey.get(workout.id) : undefined}
      onPress={() => {
        setEditError(null);
        openEditor({
          weekNumber: workout.weekNumber,
          workout: isAdditionId(workout.id)
            ? workout
            : (resolvedWorkouts.get(workout.id) ?? workout),
        });
      }}
    />
  );

  const removedByServer = (weekNumber: number) =>
    showElementDiff
      ? (diffInfo?.diff.weeks
          .find((week) => week.weekNumber === weekNumber)
          ?.workouts.filter((workout) => workout.change === "removed") ?? [])
      : [];

  const headerTitle =
    mode === "draft-edit"
      ? plansPreviewCopy.draftEditTitle
      : isCreation
        ? name || previewCopy.title
        : previewCopy.title;

  const primaryLabel = isCreation
    ? plansPreviewCopy.saveButton
    : plansPreviewCopy.saveChanges;
  const startsOn = preview.startDate
    ? formatDayMonth(preview.startDate.slice(0, 10), language)
    : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.color.screen }]}>
      <PreviewHeader
        theme={theme}
        copy={copy}
        title={headerTitle}
        onBack={onEditSettings}
        onRename={isCreation ? () => setMetaSheetVisible(true) : undefined}
        onClose={onDiscard}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.pageHint,
            { color: theme.color.mutedForeground, fontFamily: regular },
          ]}
        >
          {mode === "draft-edit"
            ? plansPreviewCopy.draftHint
            : previewCopy.hint}
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

        <PreviewSummaryCard
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          goalSummary={goalSummary}
          totalWeeks={preview.totalWeeks}
          trainingFrequency={preview.trainingFrequency}
          totalDistanceKm={totalDistance}
          startsOn={startsOn}
        />

        {preview.weeks.map((week) => {
          const view = buildPreviewWeek(
            week,
            resolvedWorkouts,
            additionsByWeek.get(week.weekNumber) ?? [],
            draft.schedule.trainingDays,
          );
          return (
            <PreviewWeekCard
              key={week.weekNumber}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              week={week}
              view={view}
              serverRemoved={removedByServer(week.weekNumber)}
              renderWorkout={renderWorkout}
              onAddWorkout={() => {
                setEditError(null);
                openEditor({
                  weekNumber: week.weekNumber,
                  workout: null,
                  defaultDayOfWeek: view.freeDay,
                });
              }}
            />
          );
        })}
      </ScrollView>

      {/* Footer: floating button pair without a bar, like the dialog actions */}
      <View style={styles.footer} pointerEvents="box-none">
        {submitError ? (
          <View style={styles.inlineErrorRow}>
            <AlertCircle color={theme.color.danger} size={14} />
            <Text
              style={[
                styles.inlineErrorText,
                { color: theme.color.danger, fontFamily: regular },
              ]}
            >
              {submitError}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => void handlePrimary()}
            >
              <Text
                style={[
                  styles.inlineErrorRetry,
                  { color: theme.color.danger, fontFamily: semibold },
                ]}
              >
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
              applyEdit(
                { weekNumber: current.weekNumber, workout: current.workout },
                changes,
              );
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
