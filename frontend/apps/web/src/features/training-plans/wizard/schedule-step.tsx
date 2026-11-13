"use client";

import type { ReactElement } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@trefix/ui/components/toggle-group";

import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

import { useWeekdayOptions, WeekdayToggle } from "../components/weekday-toggle";
import {
  PLAN_FOCUS_TYPES,
  PLAN_WIZARD_LIMITS,
  type PlanFocusType,
  type PlanWizardValues,
} from "../lib/plan-wizard-form";

const AUTO = "auto";

/** Training days, long run day, session length, plan length, sessions per week and focus. */
export function ScheduleStep({
  form,
}: {
  form: UseFormReturn<PlanWizardValues>;
}): ReactElement {
  const { t } = useI18n();
  const weekdayOptions = useWeekdayOptions();
  const errors = form.formState.errors;
  const message = (key: string | undefined) =>
    key ? [{ message: t(key) }] : undefined;

  return (
    <FieldGroup className="gap-6">
      <Field data-invalid={Boolean(errors.trainingDays) || undefined}>
        <FieldLabel htmlFor="wizard-days">
          {t("userPlans.wizard.trainingDays")}
        </FieldLabel>
        <Controller
          control={form.control}
          name="trainingDays"
          render={({ field }) => (
            <WeekdayToggle
              id="wizard-days"
              value={field.value}
              invalid={Boolean(errors.trainingDays)}
              onChange={(days) => {
                field.onChange(days);
                // More sessions than training days cannot be scheduled; follow the days down like the app does.
                const sessions = form.getValues("sessionsPerWeek");
                if (days.length > 0 && sessions > days.length) {
                  form.setValue("sessionsPerWeek", days.length);
                }
              }}
            />
          )}
        />
        <FieldError errors={message(errors.trainingDays?.message)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="wizard-long-run">
            {t("userPlans.wizard.longRunDay")}
          </FieldLabel>
          <Controller
            control={form.control}
            name="preferredLongRunDay"
            render={({ field }) => (
              <OptionSelect
                id="wizard-long-run"
                value={field.value === null ? AUTO : String(field.value)}
                options={[
                  { value: AUTO, label: t("userPlans.wizard.longRunAuto") },
                  ...weekdayOptions,
                ]}
                onValueChange={(value) =>
                  field.onChange(value === AUTO ? null : Number(value))
                }
              />
            )}
          />
        </Field>
        <Field
          data-invalid={Boolean(errors.workoutDurationMinutes) || undefined}
        >
          <FieldLabel htmlFor="wizard-duration">
            {t("userPlans.wizard.workoutDuration")}
          </FieldLabel>
          <Input
            id="wizard-duration"
            type="number"
            inputMode="numeric"
            min={PLAN_WIZARD_LIMITS.workoutDurationMinutes.min}
            max={PLAN_WIZARD_LIMITS.workoutDurationMinutes.max}
            aria-invalid={Boolean(errors.workoutDurationMinutes) || undefined}
            {...form.register("workoutDurationMinutes", {
              valueAsNumber: true,
            })}
          />
          <FieldError
            errors={message(errors.workoutDurationMinutes?.message)}
          />
        </Field>
        <Field data-invalid={Boolean(errors.totalWeeks) || undefined}>
          <FieldLabel htmlFor="wizard-weeks">
            {t("userPlans.wizard.totalWeeks")}
          </FieldLabel>
          <Input
            id="wizard-weeks"
            type="number"
            inputMode="numeric"
            min={PLAN_WIZARD_LIMITS.weeks.min}
            max={PLAN_WIZARD_LIMITS.weeks.max}
            aria-invalid={Boolean(errors.totalWeeks) || undefined}
            {...form.register("totalWeeks", { valueAsNumber: true })}
          />
          <FieldDescription>
            {t("userPlans.wizard.totalWeeksHint", {
              min: PLAN_WIZARD_LIMITS.weeks.min,
              max: PLAN_WIZARD_LIMITS.weeks.max,
            })}
          </FieldDescription>
          <FieldError errors={message(errors.totalWeeks?.message)} />
        </Field>
        <Field data-invalid={Boolean(errors.sessionsPerWeek) || undefined}>
          <FieldLabel htmlFor="wizard-sessions">
            {t("userPlans.wizard.sessionsPerWeek")}
          </FieldLabel>
          <Input
            id="wizard-sessions"
            type="number"
            inputMode="numeric"
            min={PLAN_WIZARD_LIMITS.sessions.min}
            max={PLAN_WIZARD_LIMITS.sessions.max}
            aria-invalid={Boolean(errors.sessionsPerWeek) || undefined}
            {...form.register("sessionsPerWeek", { valueAsNumber: true })}
          />
          <FieldError errors={message(errors.sessionsPerWeek?.message)} />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-focus">
          {t("userPlans.wizard.focus")}
        </FieldLabel>
        <Controller
          control={form.control}
          name="focus"
          render={({ field }) => (
            <ToggleGroup
              id="wizard-focus"
              multiple
              variant="outline"
              className="flex-wrap"
              value={field.value}
              onValueChange={(value: string[]) =>
                field.onChange(
                  PLAN_FOCUS_TYPES.filter((type) =>
                    value.includes(type),
                  ) as PlanFocusType[],
                )
              }
            >
              {PLAN_FOCUS_TYPES.map((type) => (
                <ToggleGroupItem key={type} value={type}>
                  {t(`trainingCalendar.types.${type}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
        <FieldDescription>{t("userPlans.wizard.focusHint")}</FieldDescription>
      </Field>
    </FieldGroup>
  );
}
