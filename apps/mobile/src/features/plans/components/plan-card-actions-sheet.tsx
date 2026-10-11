import { useState } from "react";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";
import { useToast } from "../../../shared/ui/toast";
import { usePlansNavigation } from "../plans-navigation";
import { ActionsSheet, type SheetAction } from "./plans-ui";
import { DeletePlanSheet } from "./delete-plan-sheet";
import { PlanMetaEditor } from "./plan-meta-editor";

export type PlanCardTarget = {
  id: string;
  name: string;
  status: string;
};

type ActionKey =
  | "start"
  | "prepareAgain"
  | "editWorkouts"
  | "editParams"
  | "meta"
  | "delete";

type Props = {
  plan: PlanCardTarget | null;
  visible: boolean;
  onClose: () => void;
  /** Called after a successful delete (e.g. to leave the details screen). */
  onDeleted?: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/** Status-dependent actions of a draft or history plan (the plan in progress has its own menu). */
export function PlanCardActionsSheet({
  plan,
  visible,
  onClose,
  onDeleted,
  theme,
  themeMode,
  copy,
}: Props) {
  const actionsCopy = copy.plans.actions;
  const navigation = usePlansNavigation();
  const { showToast } = useToast();
  const [metaPlanId, setMetaPlanId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanCardTarget | null>(null);

  const isDraft = plan?.status === "draft";
  const actions: SheetAction<ActionKey>[] = isDraft
    ? [
        { key: "start", label: actionsCopy.start },
        { key: "editWorkouts", label: actionsCopy.editWorkouts },
        { key: "editParams", label: actionsCopy.editParams },
        { key: "meta", label: actionsCopy.meta },
        { key: "delete", label: actionsCopy.delete, destructive: true },
      ]
    : [
        { key: "prepareAgain", label: actionsCopy.prepareAgain },
        { key: "meta", label: actionsCopy.meta },
        { key: "delete", label: actionsCopy.delete, destructive: true },
      ];

  const handleSelect = (key: ActionKey) => {
    if (!plan) return;
    switch (key) {
      case "start":
        navigation.startDraft(plan, "plan_card");
        return;
      case "prepareAgain":
        navigation.openCreation({ mode: "rebuild", sourcePlanId: plan.id });
        return;
      case "editWorkouts":
        navigation.openDraftEdit(plan.id);
        return;
      case "editParams":
        navigation.openCreation({ mode: "draft-params", planId: plan.id });
        return;
      case "meta":
        setMetaPlanId(plan.id);
        return;
      case "delete":
        setDeleteTarget(plan);
        return;
    }
  };

  return (
    <>
      <ActionsSheet
        visible={visible && plan !== null}
        title={plan?.name ?? actionsCopy.title}
        actions={actions}
        onSelect={handleSelect}
        onClose={onClose}
        theme={theme}
        themeMode={themeMode}
      />
      <PlanMetaEditor
        planId={metaPlanId}
        visible={metaPlanId !== null}
        onClose={() => setMetaPlanId(null)}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />
      <DeletePlanSheet
        visible={deleteTarget !== null}
        plan={deleteTarget}
        onClose={(deleted) => {
          setDeleteTarget(null);
          if (deleted) {
            showToast(copy.plans.delete.done);
            onDeleted?.();
          }
        }}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />
    </>
  );
}
