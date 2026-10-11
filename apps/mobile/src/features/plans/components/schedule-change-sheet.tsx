import { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";

import {
  type ManualPlanScheduleInput,
  type PlanConfig,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Segmented } from "@workspace/ui-native";

import { type AppLanguage, type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import { useToast } from "../../../shared/ui/toast";
import { SectionBlock } from "../../plan-creation/components/plan-creation-ui";
import {
  ScheduleStepFields,
  toggleTrainingDay,
} from "../../plan-creation/components/schedule-step-fields";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import { usePlanChangeFlow } from "../hooks/use-plan-change-flow";
import { draftFromConfig } from "../lib/plan-draft";
import { PlanChangeConfirm } from "./plan-change-confirm";
import { InlineError, Notice, plansUiStyles } from "./plans-ui";

type EffectiveFrom = "next_week" | "tomorrow";

type Props = {
  visible: boolean;
  planId: string | null;
  schedule: PlanConfig["schedule"] | undefined;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** New training days for the remaining weeks of the plan in progress, applied after a diff. */
export function ScheduleChangeSheet({
  visible,
  planId,
  schedule,
  onClose,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const scheduleCopy = copy.plans.schedule;
  const { showToast } = useToast();
  const initial = useMemo<ManualPlanScheduleInput>(
    () => draftFromConfig({ schedule }).schedule,
    [schedule],
  );
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<ManualPlanScheduleInput>(initial);
  const [effectiveFrom, setEffectiveFrom] =
    useState<EffectiveFrom>("next_week");

  const flow = usePlanChangeFlow(planId, {
    copy,
    onApplied: () => {
      showToast(copy.plans.edit.applied);
      setOpen(false);
    },
  });

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    setValue(initial);
    setEffectiveFrom("next_week");
    flow.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <BottomSheet
      title={scheduleCopy.title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={plansUiStyles.sheetScroll}
        contentContainerStyle={plansUiStyles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {flow.showDiff && flow.preview ? (
          <SheetBlock theme={theme}>
            <PlanChangeConfirm
              preview={flow.preview}
              pending={flow.applying}
              error={flow.error}
              conflict={flow.conflict}
              onApply={flow.apply}
              onCancel={flow.reset}
              onRefresh={flow.refresh}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              language={language}
            />
          </SheetBlock>
        ) : (
          <>
            <ScheduleStepFields
              schedule={value}
              onToggleDay={(day) =>
                setValue((current) => toggleTrainingDay(current, day))
              }
              onChange={(updater) => setValue(updater)}
              shortDayNames={shortDayNamesFor(language)}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
            />
            <SectionBlock title={scheduleCopy.from} theme={theme}>
              <Segmented<EffectiveFrom>
                segments={[
                  { label: scheduleCopy.nextWeek, value: "next_week" },
                  { label: scheduleCopy.tomorrow, value: "tomorrow" },
                ]}
                value={effectiveFrom}
                onChange={setEffectiveFrom}
                accessibilityLabel={scheduleCopy.from}
                theme={theme}
                themeMode={themeMode}
              />
            </SectionBlock>
            {flow.conflict ? (
              <SheetBlock theme={theme}>
                <Notice
                  tone="warning"
                  theme={theme}
                  action={{
                    label: copy.plans.edit.refresh,
                    onPress: flow.refresh,
                  }}
                >
                  {copy.plans.edit.conflict}
                </Notice>
              </SheetBlock>
            ) : null}
            {flow.error ? (
              <SheetBlock theme={theme}>
                <InlineError message={flow.error} theme={theme} />
              </SheetBlock>
            ) : null}
            <SheetBlock theme={theme}>
              <SheetButton
                label={copy.plans.edit.showChanges}
                onPress={() =>
                  void flow.submit(
                    {
                      kind: "schedule",
                      schedule: {
                        trainingDays: value.trainingDays,
                        preferredLongRunDay: value.preferredLongRunDay,
                        workoutDurationMinutes: value.workoutDurationMinutes,
                      },
                      effectiveFrom,
                    },
                    null,
                  )
                }
                disabled={value.trainingDays.length === 0 || !planId}
                pending={flow.busy}
                theme={theme}
                themeMode={themeMode}
                style={plansUiStyles.columnButton}
              />
            </SheetBlock>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
