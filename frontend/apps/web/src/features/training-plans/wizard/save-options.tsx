"use client";

import type { ReactElement } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Label } from "@trefix/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@trefix/ui/components/radio-group";
import { Textarea } from "@trefix/ui/components/textarea";

import {
  PLAN_NAME_MAX_LENGTH,
  PLAN_NOTES_MAX_LENGTH,
  type PlanStartOptions,
} from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

import { StartOptionsField } from "../components/start-options-field";
import type { PlanWizardValues } from "../lib/plan-wizard-form";

/** Name, notes and whether the plan is saved as a draft or started right away. */
export function SaveOptions({
  form,
  startOptions,
  saveError,
}: {
  form: UseFormReturn<PlanWizardValues>;
  startOptions: PlanStartOptions | undefined;
  saveError: string | null;
}): ReactElement {
  const { t } = useI18n();
  const saveMode = useWatch({ control: form.control, name: "saveMode" });
  const replaceActive = useWatch({
    control: form.control,
    name: "replaceActive",
  });
  const errors = form.formState.errors;

  return (
    <FieldGroup className="gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="wizard-name">
            {t("userPlans.meta.name")}
          </FieldLabel>
          <Input
            id="wizard-name"
            maxLength={PLAN_NAME_MAX_LENGTH}
            placeholder={t("userPlans.wizard.namePlaceholder")}
            {...form.register("name")}
          />
        </Field>
        <Field>
          <FieldLabel>{t("userPlans.wizard.saveMode")}</FieldLabel>
          <Controller
            control={form.control}
            name="saveMode"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(value) =>
                  field.onChange(value === "start" ? "start" : "draft")
                }
              >
                {(["draft", "start"] as const).map((mode) => (
                  <div key={mode} className="flex items-center gap-2">
                    <RadioGroupItem
                      id={`save-mode-${mode}`}
                      value={mode}
                      disabled={mode === "start" && !startOptions}
                    />
                    <Label
                      htmlFor={`save-mode-${mode}`}
                      className="font-normal"
                    >
                      {t(`userPlans.wizard.saveModes.${mode}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-notes">
          {t("userPlans.meta.notes")}
        </FieldLabel>
        <Textarea
          id="wizard-notes"
          rows={3}
          maxLength={PLAN_NOTES_MAX_LENGTH}
          {...form.register("notes")}
        />
      </Field>

      {saveMode === "start" && startOptions ? (
        <Controller
          control={form.control}
          name="startKind"
          render={({ field }) => (
            <StartOptionsField
              options={startOptions}
              kind={field.value}
              onKindChange={field.onChange}
              replaceActive={replaceActive}
              onReplaceActiveChange={(value) =>
                form.setValue("replaceActive", value, { shouldDirty: true })
              }
              replaceError={
                saveError === "userPlans.wizard.errors.replaceActive"
              }
            />
          )}
        />
      ) : null}

      {saveError ? <FieldError errors={[{ message: t(saveError) }]} /> : null}
    </FieldGroup>
  );
}
