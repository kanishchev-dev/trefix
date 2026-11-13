"use client";

import { useState, type ReactElement } from "react";

import { Field, FieldGroup, FieldLabel } from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Label } from "@trefix/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@trefix/ui/components/radio-group";

import type {
  PlanChangeRequest,
  PlanDetails,
  PlanWorkoutOperation,
} from "@trefix/api-client";

import {
  getBrowserTimezone,
  parseDateKey,
  toDateKey,
} from "@/features/training-calendar/lib/calendar-dates";
import { useI18n } from "@/shared/i18n";

import { workoutDateKey, type DatedWorkoutView } from "../lib/plan-weeks";
import { PlanChangeDialog } from "./plan-change-dialog";
import {
  EMPTY_WORKOUT_DRAFT,
  parsePlanWorkout,
  workoutDraftOf,
  WorkoutFields,
  type PlanWorkoutDraft,
} from "./workout-fields";

export type ActiveWorkoutDialogState =
  | { mode: "edit"; workout: DatedWorkoutView }
  | { mode: "add"; date?: string };

type EditAction = "update" | "remove";

/**
 * Changes one workout of the active plan through the preview → apply
 * protocol: the engine may move neighbours or cap volumes, and the admin sees
 * that before anything is written.
 */
function ActiveWorkoutContent({
  userId,
  plan,
  state,
  onClose,
  describe,
}: {
  userId: string;
  plan: PlanDetails;
  state: ActiveWorkoutDialogState;
  onClose: () => void;
  describe: (key: string) => string | undefined;
}): ReactElement {
  const { t } = useI18n();
  const [fields, setFields] = useState<PlanWorkoutDraft>(
    state.mode === "edit" ? workoutDraftOf(state.workout) : EMPTY_WORKOUT_DRAFT,
  );
  const [date, setDate] = useState(
    state.mode === "edit"
      ? workoutDateKey(state.workout)
      : (state.date ?? toDateKey(new Date())),
  );
  const [action, setAction] = useState<EditAction>("update");

  const today = toDateKey(new Date());
  const planEnd = plan.endDate?.slice(0, 10);
  const dateValid =
    parseDateKey(date) !== null &&
    date >= today &&
    (!planEnd || date <= planEnd);
  const parsed = parsePlanWorkout(fields);

  const request = ((): PlanChangeRequest | null => {
    const base = {
      kind: "workouts" as const,
      expectedVersion: plan.version,
      timezone: getBrowserTimezone(),
    };

    if (state.mode === "add") {
      if (!parsed || !dateValid) return null;
      return { ...base, operations: [{ op: "add", date, ...parsed }] };
    }

    const workoutId = state.workout.id;
    if (action === "remove") {
      return { ...base, operations: [{ op: "remove", workoutId }] };
    }
    if (!parsed || !dateValid) return null;

    const initial = workoutDraftOf(state.workout);
    const operations: PlanWorkoutOperation[] = [];
    if (
      fields.type !== initial.type ||
      fields.distanceKm !== initial.distanceKm ||
      fields.durationMinutes !== initial.durationMinutes
    ) {
      operations.push({ op: "update", workoutId, ...parsed });
    }
    if (date !== workoutDateKey(state.workout)) {
      operations.push({ op: "move", workoutId, date });
    }
    return operations.length > 0 ? { ...base, operations } : null;
  })();

  return (
    <PlanChangeDialog
      userId={userId}
      planId={plan.id}
      open
      onOpenChange={(open) => !open && onClose()}
      title={
        state.mode === "add"
          ? t("userPlans.workout.addTitle")
          : t("userPlans.workout.editTitle")
      }
      description={t("userPlans.workout.activeDescription")}
      request={request}
      describe={describe}
    >
      {state.mode === "edit" ? (
        <RadioGroup
          value={action}
          onValueChange={(value) =>
            setAction(value === "remove" ? "remove" : "update")
          }
        >
          {(["update", "remove"] as const).map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem id={`workout-action-${option}`} value={option} />
              <Label
                htmlFor={`workout-action-${option}`}
                className="font-normal"
              >
                {t(`userPlans.workout.actions.${option}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ) : null}

      {action === "update" ? (
        <FieldGroup className="gap-4">
          <Field data-invalid={!dateValid || undefined}>
            <FieldLabel htmlFor="active-workout-date">
              {t("trainingCalendar.form.date")}
            </FieldLabel>
            <Input
              id="active-workout-date"
              type="date"
              min={today}
              max={planEnd}
              value={date}
              aria-invalid={!dateValid || undefined}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <WorkoutFields
            idPrefix="active-workout"
            value={fields}
            onChange={setFields}
          />
        </FieldGroup>
      ) : null}
    </PlanChangeDialog>
  );
}

/** Mounted per opened workout, so the form always starts from that workout. */
export function ActiveWorkoutDialog({
  state,
  ...props
}: {
  userId: string;
  plan: PlanDetails;
  state: ActiveWorkoutDialogState | null;
  onClose: () => void;
  describe: (key: string) => string | undefined;
}): ReactElement | null {
  if (!state) return null;
  const key =
    state.mode === "edit" ? state.workout.id : `add-${state.date ?? ""}`;
  return <ActiveWorkoutContent key={key} state={state} {...props} />;
}
