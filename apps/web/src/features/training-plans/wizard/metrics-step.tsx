"use client";

import type { ReactElement } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

import { Badge } from "@workspace/ui/components/badge";
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

import type { CurrentMetrics, MetricsSource } from "@workspace/api-client";

import { toDateKey } from "@/features/training-calendar/lib/calendar-dates";
import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

import {
  RECENT_RESULT_DISTANCES,
  type PlanWizardMetrics,
  type PlanWizardValues,
} from "../lib/plan-wizard-form";

type MetricField = Exclude<
  keyof PlanWizardMetrics,
  "recentDistance" | "recentTime" | "recentDate"
>;

const FIELDS: Array<{
  field: MetricField;
  source: keyof CurrentMetrics;
  unit: string;
  placeholder?: string;
}> = [
  {
    field: "thresholdPace",
    source: "thresholdPaceSecondsPerKm",
    unit: "userPlans.units.perKm",
    placeholder: "4:50",
  },
  {
    field: "weeklyMileageKm",
    source: "weeklyMileageKm",
    unit: "userPlans.units.kmPerWeek",
  },
  { field: "longestRunKm", source: "longestRunKm", unit: "userPlans.units.km" },
  {
    field: "thresholdHeartRate",
    source: "thresholdHeartRate",
    unit: "userPlans.units.bpm",
  },
  {
    field: "maxHeartRate",
    source: "maxHeartRate",
    unit: "userPlans.units.bpm",
  },
  {
    field: "restingHeartRate",
    source: "restingHeartRate",
    unit: "userPlans.units.bpm",
  },
];

const NO_RESULT = "none";

function SourceBadge({
  source,
}: {
  source: MetricsSource | undefined;
}): ReactElement | null {
  const { t } = useI18n();
  if (!source || source === "none") return null;
  return (
    <Badge variant="secondary">
      {t(`userPlans.metrics.sources.${source}`)}
    </Badge>
  );
}

/**
 * Athlete metrics the plan's paces and volumes are calculated from,
 * prefilled with the current estimate; every field is optional.
 */
export function MetricsStep({
  form,
  currentMetrics,
}: {
  form: UseFormReturn<PlanWizardValues>;
  currentMetrics: CurrentMetrics | undefined;
}): ReactElement {
  const { t } = useI18n();
  const errors = form.formState.errors.metrics;
  const message = (key: string | undefined) =>
    key ? [{ message: t(key) }] : undefined;

  return (
    <FieldGroup className="gap-6">
      <p className="text-sm text-muted-foreground">
        {t("userPlans.metrics.hint")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ field, source, unit, placeholder }) => {
          const id = `metrics-${field}`;
          const error = errors?.[field]?.message;
          const sourceValue = currentMetrics?.[source];
          return (
            <Field key={field} data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor={id} className="flex items-center gap-2">
                {t(`userPlans.metrics.${field}`)}
                <SourceBadge
                  source={
                    sourceValue && "source" in sourceValue
                      ? sourceValue.source
                      : undefined
                  }
                />
              </FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  inputMode={field === "thresholdPace" ? "text" : "decimal"}
                  placeholder={placeholder}
                  aria-invalid={Boolean(error) || undefined}
                  {...form.register(`metrics.${field}`)}
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  {t(unit)}
                </span>
              </div>
              <FieldError errors={message(error)} />
            </Field>
          );
        })}
      </div>

      <FieldSet>
        <FieldLegend className="flex items-center gap-2">
          {t("userPlans.metrics.recentResult")}
          <SourceBadge source={currentMetrics?.recentResult.source} />
        </FieldLegend>
        <FieldDescription>
          {t("userPlans.metrics.recentResultHint")}
        </FieldDescription>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="metrics-recent-distance">
              {t("userPlans.metrics.distance")}
            </FieldLabel>
            <Controller
              control={form.control}
              name="metrics.recentDistance"
              render={({ field }) => (
                <OptionSelect
                  id="metrics-recent-distance"
                  value={field.value === "" ? NO_RESULT : field.value}
                  options={[
                    { value: NO_RESULT, label: t("userPlans.goal.notSet") },
                    ...RECENT_RESULT_DISTANCES.map((distance) => ({
                      value: distance,
                      label: t(`userPlans.metrics.distances.${distance}`),
                    })),
                  ]}
                  onValueChange={(value) => {
                    field.onChange(value === NO_RESULT ? "" : value);
                    if (
                      value !== NO_RESULT &&
                      form.getValues("metrics.recentDate") === ""
                    ) {
                      form.setValue(
                        "metrics.recentDate",
                        toDateKey(new Date()),
                      );
                    }
                  }}
                />
              )}
            />
          </Field>
          <Field data-invalid={Boolean(errors?.recentTime) || undefined}>
            <FieldLabel htmlFor="metrics-recent-time">
              {t("userPlans.metrics.time")}
            </FieldLabel>
            <Input
              id="metrics-recent-time"
              placeholder="45:30"
              aria-invalid={Boolean(errors?.recentTime) || undefined}
              {...form.register("metrics.recentTime")}
            />
            <FieldError errors={message(errors?.recentTime?.message)} />
          </Field>
          <Field data-invalid={Boolean(errors?.recentDate) || undefined}>
            <FieldLabel htmlFor="metrics-recent-date">
              {t("userPlans.metrics.date")}
            </FieldLabel>
            <Input
              id="metrics-recent-date"
              type="date"
              max={toDateKey(new Date())}
              aria-invalid={Boolean(errors?.recentDate) || undefined}
              {...form.register("metrics.recentDate")}
            />
            <FieldError errors={message(errors?.recentDate?.message)} />
          </Field>
        </div>
      </FieldSet>
    </FieldGroup>
  );
}
