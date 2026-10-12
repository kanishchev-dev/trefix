"use client";

import type { ReactElement } from "react";

import type { WorkoutType } from "@workspace/api-client";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

/** Workout types a plan workout can be switched to; races and rest days are placed by the engine only. */
export const PLAN_EDITABLE_WORKOUT_TYPES = [
  "easy",
  "long_run",
  "tempo",
  "threshold",
  "interval",
  "hill",
  "recovery",
] as const;

export type PlanWorkoutDraft = {
  type: WorkoutType;
  distanceKm: string;
  durationMinutes: string;
};

export type ParsedPlanWorkout = {
  type: WorkoutType;
  distanceKm?: number;
  durationMinutes?: number;
};

/** Mirrors the backend bounds of a single plan workout. */
const LIMITS = {
  distanceKm: { min: 0, max: 100 },
  durationMinutes: { min: 10, max: 300 },
} as const;

/** Parses the typed values; `null` when any of them is out of bounds. */
export function parsePlanWorkout(
  draft: PlanWorkoutDraft,
): ParsedPlanWorkout | null {
  const distance =
    draft.distanceKm.trim() === ""
      ? undefined
      : Number(draft.distanceKm.replace(",", "."));
  const duration =
    draft.durationMinutes.trim() === ""
      ? undefined
      : Number(draft.durationMinutes);

  if (
    distance !== undefined &&
    (!Number.isFinite(distance) ||
      distance < LIMITS.distanceKm.min ||
      distance > LIMITS.distanceKm.max)
  ) {
    return null;
  }
  if (
    duration !== undefined &&
    (!Number.isInteger(duration) ||
      duration < LIMITS.durationMinutes.min ||
      duration > LIMITS.durationMinutes.max)
  ) {
    return null;
  }
  return { type: draft.type, distanceKm: distance, durationMinutes: duration };
}

export function workoutDraftOf(workout: {
  type: WorkoutType;
  distanceKm: number;
  durationMinutes: number;
}): PlanWorkoutDraft {
  return {
    type: workout.type,
    distanceKm: String(Math.round(workout.distanceKm * 10) / 10),
    durationMinutes: String(Math.round(workout.durationMinutes)),
  };
}

export const EMPTY_WORKOUT_DRAFT: PlanWorkoutDraft = {
  type: "easy",
  distanceKm: "5",
  durationMinutes: "30",
};

/** Type, distance and duration of a plan workout. */
export function WorkoutFields({
  value,
  onChange,
  idPrefix,
}: {
  value: PlanWorkoutDraft;
  onChange: (value: PlanWorkoutDraft) => void;
  idPrefix: string;
}): ReactElement {
  const { t } = useI18n();
  const invalid = parsePlanWorkout(value) === null;
  // Keep the current type selectable even when it is not in the editable list (e.g. a race placed by the engine).
  const types: readonly WorkoutType[] = PLAN_EDITABLE_WORKOUT_TYPES.includes(
    value.type as (typeof PLAN_EDITABLE_WORKOUT_TYPES)[number],
  )
    ? PLAN_EDITABLE_WORKOUT_TYPES
    : [value.type, ...PLAN_EDITABLE_WORKOUT_TYPES];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-type`}>
          {t("trainingCalendar.form.type")}
        </FieldLabel>
        <OptionSelect
          id={`${idPrefix}-type`}
          value={value.type}
          options={types.map((type) => ({
            value: type,
            label: t(`trainingCalendar.types.${type}`),
          }))}
          onValueChange={(type) => onChange({ ...value, type })}
        />
      </Field>
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-distance`}>
          {t("trainingCalendar.form.distance")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-distance`}
          type="number"
          inputMode="decimal"
          step={0.1}
          min={LIMITS.distanceKm.min}
          max={LIMITS.distanceKm.max}
          value={value.distanceKm}
          aria-invalid={invalid || undefined}
          onChange={(event) =>
            onChange({ ...value, distanceKm: event.target.value })
          }
        />
      </Field>
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-duration`}>
          {t("trainingCalendar.form.duration")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-duration`}
          type="number"
          inputMode="numeric"
          min={LIMITS.durationMinutes.min}
          max={LIMITS.durationMinutes.max}
          value={value.durationMinutes}
          aria-invalid={invalid || undefined}
          onChange={(event) =>
            onChange({ ...value, durationMinutes: event.target.value })
          }
        />
      </Field>
    </div>
  );
}
