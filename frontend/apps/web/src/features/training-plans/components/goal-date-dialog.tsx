"use client";

import { useState, type ReactElement } from "react";

import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";

import type { PlanChangeRequest, PlanDetails } from "@trefix/api-client";

import {
  getBrowserTimezone,
  parseDateKey,
  toDateKey,
} from "@/features/training-calendar/lib/calendar-dates";
import { useI18n } from "@/shared/i18n";

import { PlanChangeDialog } from "./plan-change-dialog";

/** Moves the goal date of the active plan; the engine stretches or shrinks the remaining weeks. */
function GoalDateContent({
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
  const [date, setDate] = useState(
    plan.goal.targetDate?.slice(0, 10) ?? plan.endDate?.slice(0, 10) ?? "",
  );

  const today = toDateKey(new Date());
  const valid = parseDateKey(date) !== null && date > today;
  const request: PlanChangeRequest | null = valid
    ? {
        kind: "goal_date",
        expectedVersion: plan.version,
        timezone: getBrowserTimezone(),
        goalTargetDate: date,
      }
    : null;

  return (
    <PlanChangeDialog
      userId={userId}
      planId={plan.id}
      open={open}
      onOpenChange={onOpenChange}
      title={t("userPlans.goalDate.title")}
      description={t("userPlans.goalDate.description")}
      request={request}
    >
      <Field data-invalid={(date !== "" && !valid) || undefined}>
        <FieldLabel htmlFor="goal-date">
          {t("userPlans.goalDate.label")}
        </FieldLabel>
        <Input
          id="goal-date"
          type="date"
          min={today}
          value={date}
          aria-invalid={(date !== "" && !valid) || undefined}
          onChange={(event) => setDate(event.target.value)}
        />
        <FieldDescription>{t("userPlans.goalDate.hint")}</FieldDescription>
      </Field>
    </PlanChangeDialog>
  );
}

/** Mounted per opening, so the date always starts from the plan's current goal date. */
export function GoalDateDialog(props: {
  userId: string;
  plan: PlanDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement | null {
  return props.open ? <GoalDateContent {...props} /> : null;
}
