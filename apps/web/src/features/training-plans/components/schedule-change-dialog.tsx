"use client";

import { useState, type ReactElement } from "react";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Label } from "@trefix/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@trefix/ui/components/radio-group";

import type { PlanChangeRequest, PlanDetails } from "@trefix/api-client";

import { getBrowserTimezone } from "@/features/training-calendar/lib/calendar-dates";
import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

import { PLAN_WIZARD_LIMITS } from "../lib/plan-wizard-form";
import { PlanChangeDialog } from "./plan-change-dialog";
import { useWeekdayOptions, WeekdayToggle } from "./weekday-toggle";

const NO_LONG_RUN_DAY = "none";

/** Moves the remaining weeks of the active plan to other training days. */
function ScheduleChangeContent({
  userId,
  plan,
  open,
  onOpenChange,
}: {
  userId: string;
  plan: PlanDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement {
  const { t } = useI18n();
  const weekdayOptions = useWeekdayOptions();
  const schedule = plan.config.schedule;

  const [trainingDays, setTrainingDays] = useState<number[]>(
    schedule.trainingDays ?? [],
  );
  const [longRunDay, setLongRunDay] = useState<string>(
    schedule.preferredLongRunDay != null
      ? String(schedule.preferredLongRunDay)
      : NO_LONG_RUN_DAY,
  );
  const [duration, setDuration] = useState(
    schedule.workoutDurationMinutes
      ? String(schedule.workoutDurationMinutes)
      : "",
  );
  const [effectiveFrom, setEffectiveFrom] = useState<"next_week" | "tomorrow">(
    "next_week",
  );

  const durationValue = duration.trim() === "" ? undefined : Number(duration);
  const durationValid =
    durationValue === undefined ||
    (Number.isInteger(durationValue) &&
      durationValue >= PLAN_WIZARD_LIMITS.workoutDurationMinutes.min &&
      durationValue <= PLAN_WIZARD_LIMITS.workoutDurationMinutes.max);

  const request: PlanChangeRequest | null =
    trainingDays.length > 0 && durationValid
      ? {
          kind: "schedule",
          expectedVersion: plan.version,
          timezone: getBrowserTimezone(),
          effectiveFrom,
          schedule: {
            trainingDays,
            preferredLongRunDay:
              longRunDay === NO_LONG_RUN_DAY ? undefined : Number(longRunDay),
            workoutDurationMinutes: durationValue,
          },
        }
      : null;

  return (
    <PlanChangeDialog
      userId={userId}
      planId={plan.id}
      open={open}
      onOpenChange={onOpenChange}
      title={t("userPlans.schedule.title")}
      description={t("userPlans.schedule.description")}
      request={request}
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={trainingDays.length === 0 || undefined}>
          <FieldLabel htmlFor="schedule-days">
            {t("userPlans.wizard.trainingDays")}
          </FieldLabel>
          <WeekdayToggle
            id="schedule-days"
            value={trainingDays}
            onChange={setTrainingDays}
            invalid={trainingDays.length === 0}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="schedule-long-run">
              {t("userPlans.wizard.longRunDay")}
            </FieldLabel>
            <OptionSelect
              id="schedule-long-run"
              value={longRunDay}
              options={[
                {
                  value: NO_LONG_RUN_DAY,
                  label: t("userPlans.wizard.longRunAuto"),
                },
                ...weekdayOptions,
              ]}
              onValueChange={setLongRunDay}
            />
          </Field>
          <Field data-invalid={!durationValid || undefined}>
            <FieldLabel htmlFor="schedule-duration">
              {t("userPlans.wizard.workoutDuration")}
            </FieldLabel>
            <Input
              id="schedule-duration"
              type="number"
              inputMode="numeric"
              min={PLAN_WIZARD_LIMITS.workoutDurationMinutes.min}
              max={PLAN_WIZARD_LIMITS.workoutDurationMinutes.max}
              value={duration}
              aria-invalid={!durationValid || undefined}
              onChange={(event) => setDuration(event.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>{t("userPlans.schedule.effectiveFrom")}</FieldLabel>
          <RadioGroup
            value={effectiveFrom}
            onValueChange={(value) =>
              setEffectiveFrom(value === "tomorrow" ? "tomorrow" : "next_week")
            }
          >
            {(["next_week", "tomorrow"] as const).map((option) => (
              <div key={option} className="flex items-center gap-2">
                <RadioGroupItem id={`effective-${option}`} value={option} />
                <Label htmlFor={`effective-${option}`} className="font-normal">
                  {t(`userPlans.schedule.${option}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <FieldDescription>{t("userPlans.schedule.hint")}</FieldDescription>
        </Field>
      </FieldGroup>
    </PlanChangeDialog>
  );
}

/** The form is mounted per opening, so it always starts from the plan's current schedule. */
export function ScheduleChangeDialog(props: {
  userId: string;
  plan: PlanDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement | null {
  return props.open ? <ScheduleChangeContent {...props} /> : null;
}
