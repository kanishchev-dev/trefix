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
import { Skeleton } from "@trefix/ui/components/skeleton";
import { Spinner } from "@trefix/ui/components/spinner";

import type { PlanDetails } from "@trefix/api-client";

import { getBrowserTimezone } from "@/features/training-calendar/lib/calendar-dates";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { ErrorState } from "@/widgets/data-state";

import { useStartOptions, useStartPlan } from "../hooks/use-user-plans";
import { activePlanFromError } from "../lib/plan-errors";
import { resolveStartOption, StartOptionsField } from "./start-options-field";

/** Starts a draft: picks the start date and, when needed, replaces the plan in progress. */
function PlanStartContent({
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
  const timezone = getBrowserTimezone();
  const optionsQuery = useStartOptions(userId, plan.id, timezone, open);
  const startPlan = useStartPlan(userId, plan.id);

  const [kind, setKind] = useState("");
  const [replaceActive, setReplaceActive] = useState(false);
  const [replaceError, setReplaceError] = useState(false);

  const options = optionsQuery.data;
  const selected = resolveStartOption(options, kind);

  const submit = () => {
    if (!selected) return;
    if (options?.activePlan && !replaceActive) {
      setReplaceError(true);
      return;
    }

    startPlan.mutate(
      {
        startDate: selected.startDate,
        goalTargetDate: selected.goalTargetDate,
        replaceActive,
        timezone,
      },
      {
        onSuccess: () => {
          notifySuccess(t("userPlans.toasts.started"));
          onOpenChange(false);
        },
        onError: (error) => {
          // Another plan became active meanwhile: refresh the warning and ask for consent again.
          if (activePlanFromError(error)) {
            setReplaceError(true);
            void optionsQuery.refetch();
          }
          notifyError(
            t("common.states.error"),
            getFriendlyApiMessage(error, t),
          );
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !startPlan.isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("userPlans.start.title")}</DialogTitle>
          <DialogDescription>
            {t("userPlans.start.description", { name: plan.name })}
          </DialogDescription>
        </DialogHeader>

        {optionsQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : optionsQuery.isError || !options ? (
          <ErrorState onRetry={() => optionsQuery.refetch()} />
        ) : (
          <StartOptionsField
            options={options}
            kind={selected?.kind ?? ""}
            onKindChange={setKind}
            replaceActive={replaceActive}
            onReplaceActiveChange={(value) => {
              setReplaceActive(value);
              setReplaceError(false);
            }}
            replaceError={replaceError}
          />
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={startPlan.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={startPlan.isPending || !selected}
            onClick={submit}
          >
            {startPlan.isPending ? <Spinner /> : null}
            {t("userPlans.actions.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mounted per opening, so the choice and the consent never carry over from a previous attempt. */
export function PlanStartDialog(props: {
  userId: string;
  plan: PlanDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement | null {
  return props.open ? <PlanStartContent {...props} /> : null;
}
