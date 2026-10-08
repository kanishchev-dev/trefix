"use client";

import type { ReactElement } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

import { GOAL_TYPE_CONFIG, type GoalMetricKey } from "@workspace/api-client";

import { toDateKey } from "@/features/training-calendar/lib/calendar-dates";
import { useI18n } from "@/shared/i18n";

import {
  requiredGoalFields,
  withRequiredGoalDefaults,
} from "../lib/goal-fields";
import type { PlanWizardValues } from "../lib/plan-wizard-form";
import { GoalMetricInput } from "./goal-metric-input";
import { GoalTypeSelect } from "./goal-type-select";

const errorKey = (error: unknown): string | undefined =>
  error &&
  typeof error === "object" &&
  "message" in error &&
  typeof error.message === "string"
    ? error.message
    : undefined;

/** Goal type, its target and current values, description and target date. */
export function GoalStep({
  form,
}: {
  form: UseFormReturn<PlanWizardValues>;
}): ReactElement {
  const { t } = useI18n();
  const goalType = useWatch({ control: form.control, name: "goalType" });
  const target = useWatch({ control: form.control, name: "goalTarget" });
  const current = useWatch({ control: form.control, name: "goalCurrent" });
  const config = GOAL_TYPE_CONFIG[goalType];
  const required = requiredGoalFields(goalType);
  const errors = form.formState.errors;

  const setMetric = (
    scope: "goalTarget" | "goalCurrent",
    field: GoalMetricKey,
    value: string,
  ) => {
    const values = scope === "goalTarget" ? target : current;
    form.setValue(
      scope,
      { ...values, [field]: value },
      { shouldDirty: true, shouldValidate: form.formState.isSubmitted },
    );
  };

  return (
    <FieldGroup className="gap-6">
      <Field>
        <FieldLabel htmlFor="goal-type">{t("userPlans.goal.type")}</FieldLabel>
        <Controller
          control={form.control}
          name="goalType"
          render={({ field }) => (
            <GoalTypeSelect
              id="goal-type"
              value={field.value}
              onValueChange={(type) => {
                field.onChange(type);
                form.setValue(
                  "goalTarget",
                  withRequiredGoalDefaults(type, form.getValues("goalTarget")),
                );
                form.clearErrors([
                  "goalTarget",
                  "goalCurrent",
                  "goalDescription",
                ]);
              }}
            />
          )}
        />
        <FieldDescription>
          {t(`userPlans.goal.descriptions.${goalType}`)}
        </FieldDescription>
      </Field>

      {config.targetFields.length > 0 ? (
        <FieldSet>
          <FieldLegend>{t("userPlans.goal.targetSection")}</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            {config.targetFields.map((field) => (
              <GoalMetricInput
                key={field}
                scope="target"
                field={field}
                required={required.has(field)}
                value={target[field] ?? ""}
                onChange={(value) => setMetric("goalTarget", field, value)}
                error={errorKey(errors.goalTarget?.[field])}
              />
            ))}
          </div>
        </FieldSet>
      ) : null}

      {config.currentFields.length > 0 ? (
        <FieldSet>
          <FieldLegend>{t("userPlans.goal.currentSection")}</FieldLegend>
          <FieldDescription>{t("userPlans.goal.currentHint")}</FieldDescription>
          <div className="grid gap-4 sm:grid-cols-2">
            {config.currentFields.map((field) => (
              <GoalMetricInput
                key={field}
                scope="current"
                field={field}
                value={current[field] ?? ""}
                onChange={(value) => setMetric("goalCurrent", field, value)}
                error={errorKey(errors.goalCurrent?.[field])}
              />
            ))}
          </div>
        </FieldSet>
      ) : null}

      {config.targetFields.length === 0 && !config.requiresDescription ? (
        <p className="text-sm text-muted-foreground">
          {t("userPlans.goal.noFields")}
        </p>
      ) : null}

      <Field data-invalid={Boolean(errors.goalDescription) || undefined}>
        <FieldLabel htmlFor="goal-description">
          {t("userPlans.goal.description")}
          {config.requiresDescription ? " *" : ""}
        </FieldLabel>
        <Textarea
          id="goal-description"
          rows={3}
          maxLength={2000}
          placeholder={t("userPlans.goal.descriptionPlaceholder")}
          aria-invalid={Boolean(errors.goalDescription) || undefined}
          {...form.register("goalDescription")}
        />
        <FieldError
          errors={
            errors.goalDescription?.message
              ? [{ message: t(errors.goalDescription.message) }]
              : undefined
          }
        />
      </Field>

      <Field
        data-invalid={Boolean(errors.goalTargetDate) || undefined}
        className="max-w-xs"
      >
        <FieldLabel htmlFor="goal-target-date">
          {t("userPlans.goal.targetDate")}
        </FieldLabel>
        <Input
          id="goal-target-date"
          type="date"
          min={toDateKey(new Date())}
          aria-invalid={Boolean(errors.goalTargetDate) || undefined}
          {...form.register("goalTargetDate")}
        />
        <FieldDescription>
          {t("userPlans.goal.targetDateHint")}
        </FieldDescription>
        <FieldError
          errors={
            errors.goalTargetDate?.message
              ? [{ message: t(errors.goalTargetDate.message) }]
              : undefined
          }
        />
      </Field>
    </FieldGroup>
  );
}
