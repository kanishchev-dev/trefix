import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { usePlanDetails, useUpdatePlanMeta } from "../hooks/use-plan";
import { PlanMetaSheet } from "./plan-meta-sheet";

type Props = {
  planId: string | null;
  visible: boolean;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/** Name and notes of a stored plan; the full notes and the version come from the plan details. */
export function PlanMetaEditor({
  planId,
  visible,
  onClose,
  theme,
  themeMode,
  copy,
}: Props) {
  const detailsQuery = usePlanDetails(planId);
  const updateMeta = useUpdatePlanMeta();
  const details = detailsQuery.data;

  return (
    <PlanMetaSheet
      visible={visible && Boolean(details)}
      initialName={details?.name ?? ""}
      initialNotes={details?.notes}
      onSubmit={async ({ name, notes }) => {
        if (!details) return;
        await updateMeta.mutateAsync({
          planId: details.id,
          name: name !== details.name ? name : undefined,
          notes: notes !== details.notes ? notes : undefined,
          expectedVersion: details.version,
        });
      }}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
      copy={copy}
    />
  );
}
