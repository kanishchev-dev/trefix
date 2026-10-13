import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type WorkoutType } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { DateWheel } from "@trefix/ui-native";

import { type AppLanguage, type MainCopy } from "../../../../locales";
import { getErrorMessage } from "../../../../shared/lib/error-message";
import { SheetBlock, SheetButton } from "../../../../shared/ui/bottom-sheet";
import { useToast } from "../../../../shared/ui/toast";
import { SectionBlock } from "../../../plan-creation/components/plan-creation-ui";
import {
  validateWorkoutChanges,
  WorkoutEditForm,
} from "../../../plan-creation/components/workout-edit-form";
import {
  InlineError,
  plansUiStyles,
  SheetActionsColumn,
} from "../../../plans/components/plans-ui";
import {
  addDaysIso,
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
  onCancel: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/**
 * Change, move or remove a workout the user added by hand. Unlike plan
 * workouts there is nothing else to recalculate, so changes apply right away.
 * A planned manual workout lives on a future day: moves start from tomorrow.
 */
export function ManualWorkoutEditPanel({
  mode,
  workout,
  onDone,
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
  const [activeMode, setActiveMode] = useState<ManualWorkoutEditMode>(mode);
  const [error, setError] = useState<string | null>(null);
  const currentDate = workoutLocalDate(workout.scheduledAt);
  const tomorrow = addDaysIso(todayIso(), 1);
  const [date, setDate] = useState(
    currentDate < tomorrow ? tomorrow : currentDate,
  );
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

  if (activeMode === "edit") {
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
          onRemove={() => setActiveMode("remove")}
          onClose={onCancel}
        />
      </View>
    );
  }

  const isMove = activeMode === "move";

  return (
    <ScrollView
      style={plansUiStyles.sheetScroll}
      contentContainerStyle={plansUiStyles.sheetContent}
      showsVerticalScrollIndicator={false}
    >
      {isMove ? (
        <SectionBlock title={editCopy.dateLabel} theme={theme}>
          <DateWheel
            value={date}
            onChange={(next) => setDate(next < tomorrow ? tomorrow : next)}
            minDate={tomorrow}
            monthNames={copy.plan.creation.datePicker.months}
            accessibilityLabel={editCopy.dateLabel}
            theme={theme}
            themeMode={themeMode}
          />
        </SectionBlock>
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
      <SheetBlock theme={theme}>
        <SheetActionsColumn>
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
            style={plansUiStyles.columnButton}
          />
          <SheetButton
            label={editCopy.cancel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            theme={theme}
            themeMode={themeMode}
            style={plansUiStyles.columnButton}
          />
        </SheetActionsColumn>
      </SheetBlock>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flexShrink: 1,
    width: "100%",
  },
});
