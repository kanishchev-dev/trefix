"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";
import { Trash2Icon } from "lucide-react";

import type { DraftWeekOverride, PlanDetails } from "@workspace/api-client";

import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

import { useUpdatePlanStructure } from "../hooks/use-user-plans";
import { isVersionConflict } from "../lib/plan-errors";
import type { DraftWorkoutView } from "../lib/plan-weeks";
import { useWeekdayOptions } from "./weekday-toggle";
import {
  EMPTY_WORKOUT_DRAFT,
  parsePlanWorkout,
  workoutDraftOf,
  WorkoutFields,
  type PlanWorkoutDraft,
} from "./workout-fields";

export type DraftWorkoutDialogState =
  | { mode: "edit"; weekNumber: number; workout: DraftWorkoutView }
  | { mode: "add"; weekNumber: number };

/**
 * Edits the structure of a draft. Drafts have no dates, so a workout is
 * placed on a weekday; every save is one versioned structure update.
 */
function DraftWorkoutContent({
  userId,
  plan,
  state,
  onClose,
}: {
  userId: string;
  plan: PlanDetails;
  state: DraftWorkoutDialogState;
  onClose: () => void;
}): ReactElement {
  const { t } = useI18n();
  const weekdayOptions = useWeekdayOptions();
  const updateStructure = useUpdatePlanStructure(userId, plan.id);

  const [fields, setFields] = useState<PlanWorkoutDraft>(
    state.mode === "edit" ? workoutDraftOf(state.workout) : EMPTY_WORKOUT_DRAFT,
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    state.mode === "edit" ? String(state.workout.dayOfWeek) : "0",
  );

  const parsed = parsePlanWorkout(fields);
  // A new workout needs a duration; an edit may keep the current one.
  const canSubmit =
    parsed !== null &&
    (state.mode === "edit" || parsed.durationMinutes !== undefined);

  const save = (override: DraftWeekOverride, successKey: string) => {
    updateStructure.mutate(
      { expectedVersion: plan.version, weekOverrides: [override] },
      {
        onSuccess: () => {
          notifySuccess(t(successKey));
          onClose();
        },
        onError: (error) => {
          notifyError(
            t("common.states.error"),
            isVersionConflict(error)
              ? t("userPlans.errors.versionConflict")
              : getFriendlyApiMessage(error, t),
          );
          if (isVersionConflict(error)) onClose();
        },
      },
    );
  };

  const submit = () => {
    if (!parsed) return;
    const day = Number(dayOfWeek);

    if (state.mode === "add") {
      if (parsed.durationMinutes === undefined) return;
      save(
        {
          weekNumber: state.weekNumber,
          newWorkouts: [
            {
              type: parsed.type,
              dayOfWeek: day,
              distanceKm: parsed.distanceKm,
              durationMinutes: parsed.durationMinutes,
            },
          ],
        },
        "userPlans.toasts.workoutAdded",
      );
      return;
    }

    save(
      {
        weekNumber: state.weekNumber,
        workoutOverrides: [
          {
            key: state.workout.key,
            type: parsed.type,
            dayOfWeek: day,
            distanceKm: parsed.distanceKm,
            durationMinutes: parsed.durationMinutes,
          },
        ],
      },
      "userPlans.toasts.workoutUpdated",
    );
  };

  const remove = () => {
    if (state.mode !== "edit") return;
    save(
      { weekNumber: state.weekNumber, removedWorkoutKeys: [state.workout.key] },
      "userPlans.toasts.workoutRemoved",
    );
  };

  const isPending = updateStructure.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "add"
              ? t("userPlans.workout.addTitle")
              : t("userPlans.workout.editTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("userPlans.workout.draftDescription", {
              number: state.weekNumber,
            })}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="draft-workout-day">
              {t("userPlans.workout.day")}
            </FieldLabel>
            <OptionSelect
              id="draft-workout-day"
              value={dayOfWeek}
              options={weekdayOptions}
              onValueChange={setDayOfWeek}
            />
          </Field>
          <WorkoutFields
            idPrefix="draft-workout"
            value={fields}
            onChange={setFields}
          />
        </FieldGroup>

        <DialogFooter className="sm:justify-between">
          {state.mode === "edit" ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={isPending}
              onClick={remove}
            >
              <Trash2Icon />
              {t("userPlans.workout.remove")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onClose}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={isPending || !canSubmit}
              onClick={submit}
            >
              {isPending ? <Spinner /> : null}
              {t("common.actions.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mounted per opened workout, so the form always starts from that workout. */
export function DraftWorkoutDialog({
  state,
  ...props
}: {
  userId: string;
  plan: PlanDetails;
  state: DraftWorkoutDialogState | null;
  onClose: () => void;
}): ReactElement | null {
  if (!state) return null;
  const key =
    state.mode === "edit" ? state.workout.key : `add-${state.weekNumber}`;
  return <DraftWorkoutContent key={key} state={state} {...props} />;
}
