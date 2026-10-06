import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import { useDeletePlan } from "../hooks/use-plan";
import { planErrorMessage } from "../lib/plan-errors";
import { ConfirmSheet } from "./confirm-sheet";

type Props = {
  visible: boolean;
  plan: { id: string; name: string; status: string } | null;
  onClose: (deleted: boolean) => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/** Deletes a draft or a history plan; workouts already done stay in the calendar. */
export function DeletePlanSheet({ visible, plan, onClose, theme, themeMode, copy }: Props) {
  const deleteCopy = copy.plans.delete;
  const deleteMutation = useDeletePlan();

  return (
    <ConfirmSheet
      visible={visible}
      title={fillTemplate(deleteCopy.title, { name: plan?.name ?? "" })}
      body={deleteCopy.body}
      confirmLabel={deleteCopy.confirm}
      cancelLabel={deleteCopy.keep}
      onConfirm={async () => {
        if (!plan) return;
        await deleteMutation.mutateAsync({ planId: plan.id, status: plan.status });
      }}
      onClose={onClose}
      errorMessage={(error) => planErrorMessage(error, copy, deleteCopy.failed)}
      theme={theme}
      themeMode={themeMode}
    />
  );
}
