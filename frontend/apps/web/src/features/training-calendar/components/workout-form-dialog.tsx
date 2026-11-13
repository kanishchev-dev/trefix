"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@trefix/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@trefix/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Spinner } from "@trefix/ui/components/spinner";

import {
  ADMIN_WORKOUT_EDITABLE_STATUSES,
  ADMIN_WORKOUT_LIMITS,
  WORKOUT_TYPES,
  type AdminCalendarWorkout,
} from "@trefix/api-client";

import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

import {
  useCreateCalendarWorkout,
  useUpdateCalendarWorkout,
} from "../hooks/use-training-calendar";
import {
  getCreateFormDefaults,
  getEditFormDefaults,
  toCreateInput,
  toUpdateInput,
  workoutFormSchema,
  type WorkoutFormValues,
} from "../lib/workout-form";

export type WorkoutDialogState =
  | { mode: "create"; day: Date }
  | { mode: "edit"; workout: AdminCalendarWorkout };

export function WorkoutFormDialog({
  userId,
  state,
  onOpenChange,
  onSaved,
}: {
  userId: string;
  state: WorkoutDialogState | null;
  onOpenChange: (open: boolean) => void;
  /** Called with the saved workout, e.g. to jump to the day it moved to. */
  onSaved: (workout: AdminCalendarWorkout) => void;
}): ReactElement {
  const { t } = useI18n();
  const createWorkout = useCreateCalendarWorkout(userId);
  const updateWorkout = useUpdateCalendarWorkout(userId);
  const isPending = createWorkout.isPending || updateWorkout.isPending;

  const defaults = useMemo<WorkoutFormValues | null>(() => {
    if (!state) {
      return null;
    }
    return state.mode === "create"
      ? getCreateFormDefaults(state.day)
      : getEditFormDefaults(state.workout);
  }, [state]);

  const form = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues: defaults ?? undefined,
  });

  // The dialog stays mounted between openings; every opening starts from fresh values.
  useEffect(() => {
    if (defaults) {
      form.reset(defaults);
    }
  }, [defaults, form]);

  const typeOptions = WORKOUT_TYPES.map((type) => ({
    value: type,
    label: t(`trainingCalendar.types.${type}`),
  }));
  const statusOptions = ADMIN_WORKOUT_EDITABLE_STATUSES.map((status) => ({
    value: status,
    label: t(`trainingCalendar.statuses.${status}`),
  }));

  const handleError = (error: unknown) =>
    notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));

  const onSubmit = form.handleSubmit((values) => {
    if (!state) {
      return;
    }

    if (state.mode === "create") {
      createWorkout.mutate(toCreateInput(values), {
        onSuccess: (workout) => {
          notifySuccess(t("trainingCalendar.toasts.created"));
          onSaved(workout);
        },
        onError: handleError,
      });
      return;
    }

    const input = toUpdateInput(values, state.workout);
    if (Object.keys(input).length === 0) {
      onOpenChange(false);
      return;
    }

    updateWorkout.mutate(
      { workoutId: state.workout.id, input },
      {
        onSuccess: (workout) => {
          notifySuccess(t("trainingCalendar.toasts.updated"));
          onSaved(workout);
        },
        onError: handleError,
      },
    );
  });

  const errors = form.formState.errors;
  const errorOf = (message: string | undefined) =>
    message ? [{ message: t(message) }] : undefined;
  const isEdit = state?.mode === "edit";

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => !isPending && onOpenChange(open)}
    >
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-6" onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? t("trainingCalendar.form.editTitle")
                : t("trainingCalendar.form.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {state?.mode === "edit" && state.workout.planId
                ? t("trainingCalendar.form.planWorkoutHint")
                : t("trainingCalendar.form.description")}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.date) || undefined}>
              <FieldLabel htmlFor="workout-date">
                {t("trainingCalendar.form.date")}
              </FieldLabel>
              <Input
                id="workout-date"
                type="date"
                aria-invalid={Boolean(errors.date) || undefined}
                {...form.register("date")}
              />
              <FieldError errors={errorOf(errors.date?.message)} />
            </Field>

            <Field data-invalid={Boolean(errors.time) || undefined}>
              <FieldLabel htmlFor="workout-time">
                {t("trainingCalendar.form.time")}
              </FieldLabel>
              <Input
                id="workout-time"
                type="time"
                aria-invalid={Boolean(errors.time) || undefined}
                {...form.register("time")}
              />
              <FieldError errors={errorOf(errors.time?.message)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="workout-type">
                {t("trainingCalendar.form.type")}
              </FieldLabel>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <OptionSelect
                    id="workout-type"
                    value={field.value}
                    options={typeOptions}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="workout-status">
                {t("trainingCalendar.form.status")}
              </FieldLabel>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <OptionSelect
                    id="workout-status"
                    value={field.value}
                    options={statusOptions}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </Field>

            <Field data-invalid={Boolean(errors.distanceKm) || undefined}>
              <FieldLabel htmlFor="workout-distance">
                {t("trainingCalendar.form.distance")}
              </FieldLabel>
              <Input
                id="workout-distance"
                type="number"
                inputMode="decimal"
                step={0.1}
                min={ADMIN_WORKOUT_LIMITS.distanceKm.min}
                max={ADMIN_WORKOUT_LIMITS.distanceKm.max}
                aria-invalid={Boolean(errors.distanceKm) || undefined}
                {...form.register("distanceKm", { valueAsNumber: true })}
              />
              <FieldError errors={errorOf(errors.distanceKm?.message)} />
            </Field>

            <Field data-invalid={Boolean(errors.durationMinutes) || undefined}>
              <FieldLabel htmlFor="workout-duration">
                {t("trainingCalendar.form.duration")}
              </FieldLabel>
              <Input
                id="workout-duration"
                type="number"
                inputMode="numeric"
                step={1}
                min={ADMIN_WORKOUT_LIMITS.durationMinutes.min}
                max={ADMIN_WORKOUT_LIMITS.durationMinutes.max}
                aria-invalid={Boolean(errors.durationMinutes) || undefined}
                {...form.register("durationMinutes", { valueAsNumber: true })}
              />
              <FieldError errors={errorOf(errors.durationMinutes?.message)} />
            </Field>

            <Field
              className="sm:col-span-2"
              data-invalid={Boolean(errors.title) || undefined}
            >
              <FieldLabel htmlFor="workout-title">
                {t("trainingCalendar.form.title")}
              </FieldLabel>
              <Input
                id="workout-title"
                placeholder={t("trainingCalendar.form.titlePlaceholder")}
                maxLength={ADMIN_WORKOUT_LIMITS.titleMaxLength}
                aria-invalid={Boolean(errors.title) || undefined}
                {...form.register("title")}
              />
              <FieldError errors={errorOf(errors.title?.message)} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {isEdit ? t("common.actions.save") : t("common.actions.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
