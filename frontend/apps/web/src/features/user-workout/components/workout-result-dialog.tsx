"use client";

import { useState, type ReactElement } from "react";

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Spinner } from "@trefix/ui/components/spinner";
import { Textarea } from "@trefix/ui/components/textarea";
import { formatMinutesSeconds, parseMinutesSeconds } from "@trefix/utils";

import type { CompleteWorkoutInput, TrainingWorkout } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

type FormState = {
  duration: string;
  distance: string;
  pace: string;
  heartRate: string;
  rpe: string;
  notes: string;
};

const numberOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function toForm(workout: TrainingWorkout): FormState {
  const actual = workout.actual ?? {};
  const pace = numberOf(actual.actualAveragePaceSecondsPerKm);
  return {
    duration: String(
      numberOf(actual.actualDurationMinutes) ?? workout.durationMinutes,
    ),
    distance: String(numberOf(actual.actualDistanceKm) ?? workout.distanceKm),
    pace: pace ? formatMinutesSeconds(pace) : "",
    heartRate: numberOf(actual.actualAverageHeartRate)?.toString() ?? "",
    rpe: numberOf(actual.rpe)?.toString() ?? "",
    notes: typeof actual.notes === "string" ? actual.notes : "",
  };
}

const parse = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

/** Manual completion of a workout, or a correction of its recorded result. */
export function WorkoutResultDialog({
  workout,
  mode,
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  workout: TrainingWorkout;
  mode: "complete" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (input: CompleteWorkoutInput) => void;
}): ReactElement {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => toForm(workout));
  const [invalid, setInvalid] = useState<
    Partial<Record<keyof FormState, boolean>>
  >({});

  // Every opening starts from fresh values.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(toForm(workout));
      setInvalid({});
    }
  }

  const set = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const duration = parse(form.duration);
    const distance = parse(form.distance);
    const pace = form.pace.trim() ? parseMinutesSeconds(form.pace) : undefined;
    const heartRate = parse(form.heartRate);
    const rpe = parse(form.rpe);
    const errors = {
      duration:
        duration === undefined || Number.isNaN(duration) || duration <= 0,
      distance:
        distance === undefined || Number.isNaN(distance) || distance < 0,
      pace: pace === null,
      heartRate:
        heartRate !== undefined &&
        (Number.isNaN(heartRate) || heartRate < 30 || heartRate > 250),
      rpe: rpe !== undefined && (Number.isNaN(rpe) || rpe < 1 || rpe > 10),
    };
    setInvalid(errors);
    if (Object.values(errors).some(Boolean)) return;
    onSubmit({
      actualDurationMinutes: duration as number,
      actualDistanceKm: distance as number,
      actualAveragePaceSecondsPerKm: pace ?? undefined,
      actualAverageHeartRate:
        heartRate !== undefined ? Math.round(heartRate) : undefined,
      rpe: rpe !== undefined ? Math.round(rpe) : undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  const field = (
    key: keyof FormState,
    props: { type?: string; step?: number; placeholder?: string } = {},
  ) => (
    <Field data-invalid={invalid[key] || undefined}>
      <FieldLabel htmlFor={`result-${key}`}>
        {t(`userCard.workout.result.${key}`)}
      </FieldLabel>
      <Input
        id={`result-${key}`}
        type={props.type ?? "number"}
        inputMode="decimal"
        step={props.step}
        placeholder={props.placeholder}
        value={form[key]}
        aria-invalid={invalid[key] || undefined}
        onChange={(event) => set(key, event.target.value)}
      />
      <FieldError
        errors={
          invalid[key]
            ? [{ message: t(`userCard.workout.result.errors.${key}`) }]
            : undefined
        }
      />
    </Field>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "complete"
              ? t("userCard.workout.result.completeTitle")
              : t("userCard.workout.result.editTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "complete"
              ? t("userCard.workout.result.completeDescription")
              : t("userCard.workout.result.editDescription")}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {field("distance", { step: 0.01 })}
          {field("duration", { step: 1 })}
          {field("pace", { type: "text", placeholder: "5:30" })}
          {field("heartRate", { step: 1 })}
          {field("rpe", { step: 1 })}
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="result-notes">
              {t("userCard.workout.result.notes")}
            </FieldLabel>
            <Textarea
              id="result-notes"
              maxLength={1000}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
            />
            <FieldDescription>
              {t("userCard.workout.result.notesHint")}
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button disabled={isPending} onClick={submit}>
            {isPending ? <Spinner /> : null}
            {mode === "complete"
              ? t("userCard.workout.actions.complete")
              : t("common.actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
