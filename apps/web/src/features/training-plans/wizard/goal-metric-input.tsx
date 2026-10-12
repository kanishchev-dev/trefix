"use client";

import type { ReactElement } from "react";

import { Field, FieldError, FieldLabel } from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";

import type { GoalMetricKey } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

import { GOAL_SELECT_OPTIONS, goalFieldKind } from "../lib/goal-fields";

const NOT_SET = "__none";

const PLACEHOLDERS = { duration: "1:45:00", pace: "5:30" } as const;

/** One goal metric in the unit a coach types; the value stays a string until submit. */
export function GoalMetricInput({
  scope,
  field,
  value,
  onChange,
  error,
  required,
}: {
  scope: "target" | "current";
  field: GoalMetricKey;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}): ReactElement {
  const { t } = useI18n();
  const id = `goal-${scope}-${field}`;
  const kind = goalFieldKind(field);
  const label = `${t(`userPlans.goal.fields.${field}`)}${required ? " *" : ""}`;

  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {kind === "select" ? (
        <OptionSelect
          id={id}
          value={value === "" ? NOT_SET : value}
          invalid={Boolean(error)}
          options={[
            { value: NOT_SET, label: t("userPlans.goal.notSet") },
            ...(GOAL_SELECT_OPTIONS[field] ?? []).map((option) => ({
              value: option,
              label: t(`userPlans.goal.options.${field}.${option}`),
            })),
          ]}
          onValueChange={(next) => onChange(next === NOT_SET ? "" : next)}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={value}
            inputMode={
              kind === "integer"
                ? "numeric"
                : kind === "duration" || kind === "pace"
                  ? "text"
                  : "decimal"
            }
            placeholder={
              kind === "duration" || kind === "pace"
                ? PLACEHOLDERS[kind]
                : undefined
            }
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          <span className="shrink-0 text-sm text-muted-foreground">
            {kind === "pace"
              ? t("userPlans.units.perKm")
              : kind === "duration"
                ? t("userPlans.units.hms")
                : t(`userPlans.goal.units.${field}`)}
          </span>
        </div>
      )}
      <FieldError errors={error ? [{ message: t(error) }] : undefined} />
    </Field>
  );
}
