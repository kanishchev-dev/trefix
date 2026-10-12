import { useState } from "react";

import { type PlanOverview } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { useToast } from "../../../shared/ui/toast";
import { useActivePlan } from "../hooks/use-active-plan";
import { usePlansNavigation } from "../plans-navigation";
import { CancelPlanSheet } from "./cancel-plan-sheet";
import { GoalDateChangeSheet } from "./goal-date-change-sheet";
import { PlanMetaEditor } from "./plan-meta-editor";
import { ActionsSheet, type SheetAction } from "./plans-ui";
import { ScheduleChangeSheet } from "./schedule-change-sheet";

type ActionKey = "schedule" | "goalDate" | "meta" | "allPlans" | "cancel";

type Props = {
  visible: boolean;
  onClose: () => void;
  overview: PlanOverview;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** `⋯` menu of the plan in progress on the Plan tab. */
export function PlanActionsMenu({
  visible,
  onClose,
  overview,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const menuCopy = copy.plans.menu;
  const navigation = usePlansNavigation();
  const { showToast } = useToast();
  const activeQuery = useActivePlan();
  const [openSheet, setOpenSheet] = useState<Exclude<
    ActionKey,
    "allPlans"
  > | null>(null);
  const planId = overview.plan.id;

  const actions: SheetAction<ActionKey>[] = [
    { key: "schedule", label: menuCopy.schedule },
    { key: "goalDate", label: menuCopy.goalDate },
    { key: "meta", label: menuCopy.meta },
    { key: "allPlans", label: menuCopy.allPlans },
    { key: "cancel", label: menuCopy.cancel, destructive: true },
  ];

  const closeSheet = () => setOpenSheet(null);
  const activePlan =
    activeQuery.data?.plan?.id === planId ? activeQuery.data.plan : null;

  return (
    <>
      <ActionsSheet
        visible={visible}
        title={overview.plan.name ?? menuCopy.title}
        actions={actions}
        onSelect={(key) => {
          if (key === "allPlans") {
            navigation.openPlans({ source: "plan_menu" });
            return;
          }
          if (key === "cancel") void activeQuery.refetch();
          setOpenSheet(key);
        }}
        onClose={onClose}
        theme={theme}
        themeMode={themeMode}
      />
      <ScheduleChangeSheet
        visible={openSheet === "schedule"}
        planId={planId}
        schedule={overview.plan.config?.schedule}
        onClose={closeSheet}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
        language={language}
      />
      <GoalDateChangeSheet
        visible={openSheet === "goalDate"}
        planId={planId}
        goalTargetDate={overview.plan.goal.targetDate}
        onClose={closeSheet}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
        language={language}
      />
      <PlanMetaEditor
        planId={openSheet === "meta" ? planId : null}
        visible={openSheet === "meta"}
        onClose={closeSheet}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />
      <CancelPlanSheet
        visible={openSheet === "cancel" && activePlan !== null}
        plan={activePlan}
        onClose={(cancelled) => {
          closeSheet();
          if (cancelled) showToast(copy.plans.cancel.done);
        }}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
        language={language}
      />
    </>
  );
}
