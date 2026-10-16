import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type WorkoutType } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { DateWheel } from "@trefix/ui-native";

import { type AppLanguage, type MainCopy } from "../../../../locales";
import { getErrorMessage } from "../../../../shared/lib/error-message";
import { SheetBlock, SheetButton } from "../../../../shared/ui/bottom-sheet";
import { useToast } from "../../../../shared/ui/toast";
import {
  validateWorkoutChanges,
  WorkoutEditForm,
} from "../../../plan-creation/components/workout-edit-form";
import {
  InlineError,
  plansUiStyles,
  SHEET_ACTION_BAR_SPACE,
  SheetActionBar,
} from "../../../plans/components/plans-ui";
import {
  mondayBasedWeekday,
  todayIso,
  workoutLocalDate,
} from "../../../plans/lib/plan-dates";
import { useDeleteWorkout, useUpdateWorkout } from "../../hooks/use-workouts";

export type ManualWorkoutEditMode = "edit" | "move" | "remove";

export type ManualWorkoutRef = {
  id: string;
  type: WorkoutType;
  distanceKm: number;
  durationMinutes: number;
  scheduledAt: string;
};

type Props = {
  mode: ManualWorkoutEditMode;
  workout: ManualWorkoutRef;
  /** Called after the change is saved; `removed` when the workout is gone. */
  onDone: (removed: boolean) => void;
  /** Back to the actions menu. */
  onBack: () => void;
  /** Close without changes. */
  onCancel: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/**
 * Change, move or remove a workout the user added by hand. Unlike plan
 * workouts there is nothing else to recalculate, so changes apply right away.
 * A planned manual workout lives on today or a later day: moves start from today.
 */
export function ManualWorkoutEditPanel({
  mode,
  workout,
  onDone,
  onBack,
  onCancel,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const editCopy = copy.plans.edit;
  const t = copy.today.details.manual;
  const { showToast } = useToast();
  const updateMutation = useUpdateWorkout();
  const deleteMutation = useDeleteWorkout();
  const [error, setError] = useState<string | null>(null);
  const currentDate = workoutLocalDate(workout.scheduledAt);
  const today = todayIso();
  const [date, setDate] = useState(currentDate < today ? today : currentDate);
  const busy = updateMutation.isPending || deleteMutation.isPending;

  const fail = (reason: unknown) =>
    setError(getErrorMessage(reason, copy.errors, editCopy.invalid));

  const save = async (
    dto: Parameters<typeof updateMutation.mutateAsync>[0]["dto"],
  ) => {
    setError(null);
    try {
      await updateMutation.mutateAsync({ workoutId: workout.id, dto });
      showToast(t.saved);
      onDone(false);
    } catch (reason) {
      fail(reason);
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await deleteMutation.mutateAsync(workout.id);
      showToast(t.removed);
      onDone(true);
    } catch (reason) {
      fail(reason);
    }
  };

  if (mode === "edit") {
    return (
      <View style={styles.fill}>
        <WorkoutEditForm
          workout={{
            ...workout,
            dayOfWeek: mondayBasedWeekday(currentDate),
          }}
          showDay={false}
          pending={busy}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
          error={error}
          onSave={(changes) => {
            const invalid = validateWorkoutChanges(changes);
            if (invalid) {
              setError(
                (copy.plan.creation.errors as Record<string, string>)[
                  invalid
                ] ?? editCopy.invalid,
              );
              return;
            }
            void save({
              type: changes.type,
              distanceKm: changes.distanceKm,
              durationMinutes: changes.durationMinutes,
            });
          }}
          onClose={onBack}
          onCancel={onCancel}
          cancelLabel={editCopy.cancel}
        />
      </View>
    );
  }

  const isMove = mode === "move";

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
        {isMove ? (
          // The sheet title already says what is chosen: no caption above the wheel.
          <SheetBlock theme={theme}>
            <DateWheel
              value={date}
              onChange={(next) => setDate(next < today ? today : next)}
              minDate={today}
              monthNames={copy.plan.creation.datePicker.months}
              accessibilityLabel={editCopy.dateLabel}
              theme={theme}
              themeMode={themeMode}
            />
          </SheetBlock>
        ) : (
          <SheetBlock theme={theme}>
            <Text
              style={[
                plansUiStyles.bodyText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {t.removeBody}
            </Text>
          </SheetBlock>
        )}
        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}
      </ScrollView>
      <SheetActionBar
        theme={theme}
        onBack={onBack}
        backLabel={copy.plan.creation.common.back}
      >
        <SheetButton
          label={editCopy.cancel}
          variant="secondary"
          onPress={onCancel}
          disabled={busy}
          theme={theme}
          themeMode={themeMode}
        />
        <SheetButton
          label={isMove ? editCopy.save : editCopy.remove}
          variant={isMove ? "primary" : "destructive"}
          pending={busy}
          disabled={isMove && date === currentDate}
          onPress={() =>
            void (isMove
              ? save({ scheduledAt: `${date}T09:00:00.000Z` })
              : remove())
          }
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
