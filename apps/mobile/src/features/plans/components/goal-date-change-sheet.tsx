import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { DateWheel } from "@workspace/ui-native";

import { pluralize, type AppLanguage, type MainCopy } from "../../../locales";
import { BottomSheet, SheetBlock, SheetButton } from "../../../shared/ui/bottom-sheet";
import { useToast } from "../../../shared/ui/toast";
import { SectionBlock } from "../../plan-creation/components/plan-creation-ui";
import { usePlanChangeFlow } from "../hooks/use-plan-change-flow";
import { addDaysIso, todayIso } from "../lib/plan-dates";
import { hasErrorCode } from "../lib/plan-errors";
import { PlanChangeConfirm } from "./plan-change-confirm";
import { InlineError, Notice, plansUiStyles } from "./plans-ui";

/** The race cannot be closer than two weeks: the plan needs room for a taper. */
const MIN_DAYS_AHEAD = 14;
const DEFAULT_DAYS_AHEAD = 56;

type Props = {
  visible: boolean;
  planId: string | null;
  goalTargetDate: string | null | undefined;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Moves the goal date; the server stretches or shortens the plan and shows the diff. */
export function GoalDateChangeSheet({ visible, planId, goalTargetDate, onClose, theme, themeMode, copy, language }: Props) {
  const goalCopy = copy.plans.goalDate;
  const { showToast } = useToast();
  const minDate = addDaysIso(todayIso(), MIN_DAYS_AHEAD);
  const initialDate = () => {
    const current = goalTargetDate?.slice(0, 10);
    return current && current >= minDate ? current : addDaysIso(todayIso(), DEFAULT_DAYS_AHEAD);
  };
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initialDate);

  const flow = usePlanChangeFlow(planId, {
    copy,
    inlineErrorFor: (error) => (hasErrorCode(error, "PLAN_RESIZE_NOT_POSSIBLE") ? goalCopy.tooShort : null),
    onApplied: () => {
      showToast(copy.plans.edit.applied);
      setOpen(false);
    },
  });

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    setDate(initialDate());
    flow.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const lengthHint = (() => {
    const weeks = flow.preview?.diff.summary.totalWeeks;
    if (!weeks || weeks.before === null || weeks.after === null) return null;
    const delta = weeks.after - weeks.before;
    if (delta > 0) return pluralize(goalCopy.longer, delta, language);
    if (delta < 0) return pluralize(goalCopy.shorter, -delta, language);
    return goalCopy.same;
  })();

  return (
    <BottomSheet
      title={goalCopy.title}
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
        <SectionBlock title={goalCopy.title} description={goalCopy.minHint} theme={theme}>
          <DateWheel
            value={date}
            onChange={(next) => {
              setDate(next < minDate ? minDate : next);
              if (flow.stage === "confirm") flow.reset();
            }}
            minDate={minDate}
            monthNames={copy.plan.creation.datePicker.months}
            accessibilityLabel={goalCopy.title}
            theme={theme}
            themeMode={themeMode}
          />
        </SectionBlock>

        {lengthHint && flow.showDiff ? (
          <SheetBlock theme={theme}>
            <Text
              style={[plansUiStyles.bodyText, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium, textAlign: "center" }]}
            >
              {lengthHint}
            </Text>
          </SheetBlock>
        ) : null}

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
            {flow.conflict ? (
              <SheetBlock theme={theme}>
                <Notice tone="warning" theme={theme} action={{ label: copy.plans.edit.refresh, onPress: flow.refresh }}>
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
                onPress={() => void flow.submit({ kind: "goal_date", goalTargetDate: date }, null)}
                disabled={!planId}
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
