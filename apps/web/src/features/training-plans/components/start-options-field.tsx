"use client";

import type { ReactElement } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@trefix/ui/components/alert";
import { Checkbox } from "@trefix/ui/components/checkbox";
import { Field, FieldLabel } from "@trefix/ui/components/field";
import { Label } from "@trefix/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@trefix/ui/components/radio-group";
import { TriangleAlertIcon } from "lucide-react";

import type { PlanStartOption, PlanStartOptions } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

import { formatPlanDate } from "../lib/plan-format";

/** The option the admin picked, or the backend's recommendation. */
export function resolveStartOption(
  options: PlanStartOptions | undefined,
  kind: string,
): PlanStartOption | null {
  if (!options) return null;
  const usable = options.options.filter((option) => option.fits !== false);
  return (
    usable.find((option) => option.kind === kind) ??
    usable.find((option) => option.kind === options.recommended) ??
    null
  );
}

/**
 * Start date choice (today, next Monday, aligned to the race) plus the
 * explicit consent to replace the user's plan in progress, the same rule
 * the app enforces.
 */
export function StartOptionsField({
  options,
  kind,
  onKindChange,
  replaceActive,
  onReplaceActiveChange,
  replaceError,
}: {
  options: PlanStartOptions;
  kind: string;
  onKindChange: (kind: string) => void;
  replaceActive: boolean;
  onReplaceActiveChange: (value: boolean) => void;
  replaceError?: boolean;
}): ReactElement {
  const { t, locale } = useI18n();
  const selected = resolveStartOption(options, kind);

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>{t("userPlans.start.when")}</FieldLabel>
        <RadioGroup
          value={selected?.kind ?? ""}
          onValueChange={(value) => onKindChange(String(value))}
        >
          {options.options.map((option) => {
            const disabled = option.fits === false;
            const id = `start-option-${option.kind}`;
            return (
              <div key={option.kind} className="flex items-start gap-2">
                <RadioGroupItem
                  id={id}
                  value={option.kind}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={id}
                  className="flex flex-col items-start gap-0.5 font-normal"
                >
                  <span>
                    {t(`userPlans.start.options.${option.kind}`)}
                    {option.kind === options.recommended
                      ? ` · ${t("userPlans.start.recommended")}`
                      : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {disabled
                      ? t("userPlans.start.doesNotFit")
                      : t("userPlans.start.range", {
                          start: formatPlanDate(option.startDate, locale),
                          end: formatPlanDate(option.endDate, locale),
                        })}
                  </span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </Field>

      {options.metricsStale ? (
        <p className="text-sm text-muted-foreground">
          {t("userPlans.start.metricsStale")}
        </p>
      ) : null}

      {options.activePlan ? (
        <Alert variant={replaceError ? "destructive" : "default"}>
          <TriangleAlertIcon />
          <AlertTitle>
            {t("userPlans.start.activeTitle", {
              name: options.activePlan.name,
            })}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {t("userPlans.start.activeDescription", {
                week: options.activePlan.currentWeek,
                total: options.activePlan.totalWeeks,
                completed: options.activePlan.completedWorkouts,
                future: options.activePlan.futurePlannedWorkouts,
              })}
            </span>
            <span className="flex items-center gap-2">
              <Checkbox
                id="replace-active"
                checked={replaceActive}
                onCheckedChange={(checked) =>
                  onReplaceActiveChange(checked === true)
                }
              />
              <Label htmlFor="replace-active" className="font-normal">
                {t("userPlans.start.replaceActive")}
              </Label>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
