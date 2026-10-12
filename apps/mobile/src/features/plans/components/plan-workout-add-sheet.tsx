import { useEffect, useState } from "react";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { BottomSheet } from "../../../shared/ui/bottom-sheet";
import { PlanWorkoutEditPanel } from "./plan-workout-edit-panel";

type Props = {
  visible: boolean;
  planId: string | null;
  defaultDate?: string;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Adds a workout to a future week of the plan in progress. */
export function PlanWorkoutAddSheet({
  visible,
  planId,
  defaultDate,
  onClose,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (visible) setOpen(true);
  }, [visible]);

  return (
    <BottomSheet
      title={copy.plans.edit.addTitle}
      visible={open && Boolean(planId)}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      {planId ? (
        <PlanWorkoutEditPanel
          key={`${planId}-${defaultDate ?? ""}-${visible ? "open" : "closed"}`}
          planId={planId}
          mode="add"
          defaultDate={defaultDate}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
        />
      ) : null}
    </BottomSheet>
  );
}
