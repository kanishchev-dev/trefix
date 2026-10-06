import { type ActivePlanSummary } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, pluralize, type AppLanguage, type MainCopy } from "../../../locales";
import { trackEvent } from "../../../lib/analytics";
import { useCancelPlan } from "../hooks/use-start-plan";
import { planErrorMessage } from "../lib/plan-errors";
import { ConfirmSheet } from "./confirm-sheet";

type Props = {
  visible: boolean;
  plan: ActivePlanSummary | null;
  onClose: (cancelled: boolean) => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Confirms cancelling the plan in progress; the plan moves to history. */
export function CancelPlanSheet({ visible, plan, onClose, theme, themeMode, copy, language }: Props) {
  const cancelCopy = copy.plans.cancel;
  const cancelMutation = useCancelPlan();

  const body = plan
    ? [
        fillTemplate(cancelCopy.progress, { current: plan.currentWeek, total: plan.totalWeeks }),
        `${pluralize(copy.plans.warning.completedKept, plan.completedWorkouts, language)}.`,
        `${pluralize(copy.plans.warning.plannedRemoved, plan.futurePlannedWorkouts, language)}.`,
        cancelCopy.body,
      ].join(" ")
    : cancelCopy.body;

  return (
    <ConfirmSheet
      visible={visible}
      title={fillTemplate(cancelCopy.title, { name: plan?.name ?? "" })}
      body={body}
      confirmLabel={cancelCopy.confirm}
      cancelLabel={cancelCopy.keep}
      onConfirm={async () => {
        if (!plan) return;
        await cancelMutation.mutateAsync({ planId: plan.id });
        trackEvent("plan_cancelled", { week: plan.currentWeek, totalWeeks: plan.totalWeeks });
      }}
      onClose={onClose}
      errorMessage={(error) => planErrorMessage(error, copy, cancelCopy.failed)}
      theme={theme}
      themeMode={themeMode}
    />
  );
}
