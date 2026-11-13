import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type WorkoutType } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { DateWheel } from "@trefix/ui-native";

import {
  formatDayMonth,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { SheetBlock, SheetButton } from "../../../shared/ui/bottom-sheet";
import { useToast } from "../../../shared/ui/toast";
import { SectionBlock } from "../../plan-creation/components/plan-creation-ui";
import {
  WorkoutEditForm,
  shortDayNamesFor,
  validateWorkoutChanges,
} from "../../plan-creation/components/workout-edit-form";
import { usePlanDetails } from "../hooks/use-plan";
import { usePlanChangeFlow } from "../hooks/use-plan-change-flow";
import {
  clampIso,
  mondayBasedWeekday,
  todayIso,
  workoutLocalDate,
} from "../lib/plan-dates";
import { type WorkoutDescriber } from "../lib/plan-diff";
import { PlanChangeConfirm } from "./plan-change-confirm";
import {
  InlineError,
  Notice,
  plansUiStyles,
  SHEET_ACTION_BAR_SPACE,
  SheetActionBar,
} from "./plans-ui";

export type PlanWorkoutEditMode = "edit" | "move" | "remove" | "add";

export type PlanWorkoutRef = {
  id: string;
  type: WorkoutType;
  distanceKm: number;
  durationMinutes: number;
  scheduledAt: string;
};

type Props = {
  planId: string;
  mode: PlanWorkoutEditMode;
  /** Edited workout (edit, move, remove). */
  workout?: PlanWorkoutRef | null;
  /** Suggested date of a new workout (add). */
  defaultDate?: string;
  /** Called after the change is applied. */
  onDone: () => void;
  /** Back to the host view without changes. */
  onCancel: () => void;
  /**
   * Closes the whole flow when the host has a separate Back (onCancel). Adds a
   * Cancel button and drops Delete from the edit form.
   */
  onDismiss?: () => void;
  /** Overrides the confirmation text of a removal. */
  removeBody?: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/**
 * Edits one workout of the plan in progress inside the hosting sheet:
 * change, move, delete or add. Every action goes through the server preview;
 * side effects are shown before applying.
 */
export function PlanWorkoutEditPanel({
  planId,
  mode,
  workout,
  defaultDate,
  onDone,
  onCancel,
  onDismiss,
  removeBody,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const editCopy = copy.plans.edit;
  const { showToast } = useToast();
  const detailsQuery = usePlanDetails(planId);
  const planEnd = detailsQuery.data?.endDate ?? null;
  const today = todayIso();
  const dayNames = shortDayNamesFor(language);

  const [date, setDate] = useState(() =>
    clampIso(
      workout ? workoutLocalDate(workout.scheduledAt) : (defaultDate ?? today),
      today,
      planEnd,
    ),
  );
  const [formError, setFormError] = useState<string | null>(null);
  // Delete from the edit form asks for confirmation first.
  const [activeMode, setActiveMode] = useState<PlanWorkoutEditMode>(mode);

  const flow = usePlanChangeFlow(planId, {
    copy,
    onApplied: () => {
      showToast(editCopy.applied);
      onDone();
    },
  });

  const describeWorkout = useMemo<WorkoutDescriber>(() => {
    const workouts = detailsQuery.data?.workouts ?? [];
    return (key) => {
      const item = workouts.find((candidate) => candidate.id === key);
      if (!item) return undefined;
      return {
        type: item.type,
        dayLabel: formatDayMonth(workoutLocalDate(item.scheduledAt), language),
      };
    };
  }, [detailsQuery.data?.workouts, language]);

  const dateWheel = (label: string) => (
    <SectionBlock title={label} theme={theme}>
      <DateWheel
        value={date}
        onChange={(next) => setDate(clampIso(next, today, planEnd))}
        minDate={today}
        monthNames={copy.plan.creation.datePicker.months}
        accessibilityLabel={label}
        theme={theme}
        themeMode={themeMode}
      />
    </SectionBlock>
  );

  if (flow.showDiff && flow.preview) {
    return (
      <ScrollView
        style={plansUiStyles.sheetScroll}
        contentContainerStyle={plansUiStyles.sheetContent}
      >
        <SheetBlock theme={theme}>
          <PlanChangeConfirm
            preview={flow.preview}
            describeWorkout={describeWorkout}
            pending={flow.applying}
            error={flow.error}
            conflict={flow.conflict}
            onApply={flow.apply}
            onCancel={() => {
              flow.reset();
              onCancel();
            }}
            onRefresh={flow.refresh}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        </SheetBlock>
      </ScrollView>
    );
  }

  const status = (
    <>
      {flow.conflict ? (
        <SheetBlock theme={theme}>
          <Notice
            tone="warning"
            theme={theme}
            action={{ label: editCopy.refresh, onPress: flow.refresh }}
          >
            {editCopy.conflict}
          </Notice>
        </SheetBlock>
      ) : null}
      {flow.error || formError ? (
        <SheetBlock theme={theme}>
          <InlineError message={flow.error ?? formError ?? ""} theme={theme} />
        </SheetBlock>
      ) : null}
    </>
  );

  if (activeMode === "edit" && workout) {
    return (
      <View style={styles.fill}>
        {status}
        <WorkoutEditForm
          workout={{
            ...workout,
            dayOfWeek: mondayBasedWeekday(
              workoutLocalDate(workout.scheduledAt),
            ),
          }}
          showDay={false}
          pending={flow.busy}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
          error={null}
          onSave={(changes) => {
            const validation = validateWorkoutChanges(changes);
            if (validation) {
              setFormError(
                (copy.plan.creation.errors as Record<string, string>)[
                  validation
                ] ?? editCopy.invalid,
              );
              return;
            }
            setFormError(null);
            void flow.submit(
              {
                kind: "workouts",
                operations: [
                  {
                    op: "update",
                    workoutId: workout.id,
                    type: changes.type,
                    distanceKm: changes.distanceKm,
                    durationMinutes: changes.durationMinutes,
                  },
                ],
              },
              { workoutIds: [workout.id], addedCount: 0 },
            );
          }}
          onRemove={onDismiss ? undefined : () => setActiveMode("remove")}
          onClose={onCancel}
          onCancel={onDismiss}
          cancelLabel={editCopy.cancel}
        />
      </View>
    );
  }

  if (activeMode === "add") {
    return (
      <View style={styles.fill}>
        {status}
        <WorkoutEditForm
          workout={null}
          defaultDayOfWeek={mondayBasedWeekday(date)}
          showDay={false}
          header={dateWheel(editCopy.dateLabel)}
          pending={flow.busy}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
          error={null}
          onSave={(changes) => {
            const validation = validateWorkoutChanges(changes);
            if (validation) {
              setFormError(
                (copy.plan.creation.errors as Record<string, string>)[
                  validation
                ] ?? editCopy.invalid,
              );
              return;
            }
            setFormError(null);
            void flow.submit(
              {
                kind: "workouts",
                operations: [
                  {
                    op: "add",
                    date,
                    type: changes.type ?? "easy",
                    distanceKm: changes.distanceKm,
                    durationMinutes: changes.durationMinutes ?? 30,
                  },
                ],
              },
              { workoutIds: [], addedCount: 1 },
            );
          }}
          onClose={onCancel}
        />
      </View>
    );
  }

  const isMove = activeMode === "move";
  const typeLabel = workout
    ? ((copy.plan.creation.workoutTypes as Record<string, string>)[
        workout.type
      ] ?? workout.type)
    : "";

  return (
    <View style={styles.fill}>
      <ScrollView
        style={plansUiStyles.sheetScroll}
        contentContainerStyle={[
          plansUiStyles.sheetContent,
          { paddingBottom: SHEET_ACTION_BAR_SPACE },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {workout ? (
          <SheetBlock theme={theme}>
            <Text
              style={[
                plansUiStyles.bodyText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {`${dayNames[mondayBasedWeekday(workoutLocalDate(workout.scheduledAt))]} ${formatDayMonth(
                workoutLocalDate(workout.scheduledAt),
                language,
              )} · ${typeLabel}`}
            </Text>
            {!isMove ? (
              <Text
                style={[
                  plansUiStyles.bodyText,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {removeBody ?? editCopy.removeBody}
              </Text>
            ) : null}
          </SheetBlock>
        ) : null}
        {isMove ? (
          onDismiss ? (
            // Hosted with its own sheet title ("change date"): no caption above the wheel.
            <SheetBlock theme={theme}>
              <DateWheel
                value={date}
                onChange={(next) => setDate(clampIso(next, today, planEnd))}
                minDate={today}
                monthNames={copy.plan.creation.datePicker.months}
                accessibilityLabel={editCopy.dateLabel}
                theme={theme}
                themeMode={themeMode}
              />
            </SheetBlock>
          ) : (
            dateWheel(editCopy.dateLabel)
          )
        ) : null}
        {status}
      </ScrollView>
      <SheetActionBar
        theme={theme}
        onBack={onCancel}
        backLabel={copy.plan.creation.common.back}
      >
        {onDismiss ? (
          <SheetButton
            label={editCopy.cancel}
            variant="secondary"
            onPress={onDismiss}
            disabled={flow.busy}
            theme={theme}
            themeMode={themeMode}
          />
        ) : null}
        <SheetButton
          label={isMove ? editCopy.save : editCopy.remove}
          variant={isMove ? "primary" : "destructive"}
          pending={flow.busy}
          disabled={
            !workout ||
            (isMove && date === workoutLocalDate(workout.scheduledAt))
          }
          onPress={() => {
            if (!workout) return;
            void flow.submit(
              isMove
                ? {
                    kind: "workouts",
                    operations: [{ op: "move", workoutId: workout.id, date }],
                  }
                : {
                    kind: "workouts",
                    operations: [{ op: "remove", workoutId: workout.id }],
                  },
              { workoutIds: [workout.id], addedCount: 0 },
            );
          }}
          theme={theme}
          themeMode={themeMode}
        />
      </SheetActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flexShrink: 1,
    width: "100%",
  },
});
