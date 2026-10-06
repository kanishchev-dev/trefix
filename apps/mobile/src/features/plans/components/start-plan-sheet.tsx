import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  type ActivePlanSummary,
  type PlanStartBlock,
  type PlanStartOption,
  type PlanStartOptions,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { DateWheel } from "@workspace/ui-native";

import {
  fillTemplate,
  formatDayMonth,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { trackEvent } from "../../../lib/analytics";
import { BottomSheet, SheetBlock, SheetButton, SheetSectionLabel } from "../../../shared/ui/bottom-sheet";
import { useActivePlan } from "../hooks/use-active-plan";
import { useStartOptions } from "../hooks/use-start-plan";
import { activePlanFromError, hasErrorCode, planErrorMessage } from "../lib/plan-errors";
import { addDaysIso, clampIso, getDeviceTimezone, planEndDate } from "../lib/plan-dates";
import {
  buildStartBlock,
  initialStartChoice,
  isOptionSelectable,
  type StartChoice,
} from "../lib/start-plan";
import { ActivePlanWarning } from "./active-plan-warning";
import { InlineError, Notice, plansUiStyles, SheetActionsColumn } from "./plans-ui";

export type StartSheetResult = "started" | "draft";

type Props = {
  visible: boolean;
  /** Called after the sheet has slid away. */
  onClose: (result: StartSheetResult | null) => void;
  /** `draft` starts a stored draft; `creation` finishes the creation flow. */
  mode: "draft" | "creation";
  planName: string;
  /** Draft mode: start options are loaded for this plan. */
  planId?: string;
  /** Creation mode: start options that came with the preview. */
  options?: PlanStartOptions | null;
  /** Analytics entry point. */
  entry: string;
  onStart: (block: PlanStartBlock) => Promise<void>;
  onSaveDraft?: () => Promise<void>;
  /** Opens the metrics step of the draft; shown when metrics are stale. */
  onUpdateMetrics?: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

const CUSTOM_RANGE_DAYS = 365;

/**
 * The single way to start a plan: choose the start date and, when another
 * plan is in progress, confirm replacing it after seeing what happens to it.
 */
export function StartPlanSheet({
  visible,
  onClose,
  mode,
  planName,
  planId,
  options: creationOptions,
  entry,
  onStart,
  onSaveDraft,
  onUpdateMetrics,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const startCopy = copy.plans.start;
  const [open, setOpen] = useState(false);
  const [goalTargetDate, setGoalTargetDate] = useState<string | undefined>(undefined);
  const [choice, setChoice] = useState<StartChoice | null>(null);
  const [conflictActive, setConflictActive] = useState<ActivePlanSummary | null>(null);
  const [pending, setPending] = useState<"start" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raceDateEditor, setRaceDateEditor] = useState<string | null>(null);
  const result = useRef<StartSheetResult | null>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const warningShown = useRef(false);
  const openedTracked = useRef(false);

  const isDraft = mode === "draft";
  const optionsQuery = useStartOptions(planId, goalTargetDate, visible && isDraft);
  const activeQuery = useActivePlan({ enabled: visible, fresh: true });
  const options = isDraft ? optionsQuery.data ?? null : creationOptions ?? null;

  const activePlan = useMemo(() => {
    const candidate =
      conflictActive ?? (activeQuery.isSuccess ? activeQuery.data.plan : options?.activePlan ?? null);
    return candidate && candidate.id !== planId ? candidate : null;
  }, [activeQuery.data, activeQuery.isSuccess, conflictActive, options?.activePlan, planId]);

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    setGoalTargetDate(undefined);
    setChoice(null);
    setConflictActive(null);
    setPending(null);
    setError(null);
    setRaceDateEditor(null);
    result.current = null;
    afterClose.current = null;
    warningShown.current = false;
    openedTracked.current = false;
  }, [visible]);

  // Keep the selection valid when options arrive or change (another race date).
  useEffect(() => {
    if (!options) return;
    setChoice((current) => {
      if (current?.kind === "custom") return current;
      const stillThere = current && options.options.find((option) => option.kind === current.kind);
      if (stillThere && isOptionSelectable(stillThere)) {
        return { kind: stillThere.kind, startDate: stillThere.startDate, goalTargetDate: stillThere.goalTargetDate };
      }
      return initialStartChoice(options);
    });
  }, [options]);

  useEffect(() => {
    if (activePlan) warningShown.current = true;
  }, [activePlan]);

  useEffect(() => {
    if (!visible || !options || openedTracked.current || !activeQuery.isSuccess) return;
    openedTracked.current = true;
    trackEvent("plan_start_sheet_opened", {
      entry,
      hasActivePlan: Boolean(activePlan),
      hasRaceOption: options.options.some((option) => option.kind === "race_aligned"),
      metricsStale: options.metricsStale,
    });
  }, [activePlan, activeQuery.isSuccess, entry, options, visible]);

  const close = (next: StartSheetResult | null, then?: () => void) => {
    result.current = next;
    afterClose.current = then ?? null;
    setOpen(false);
  };

  const handleStart = async () => {
    if (!choice || pending) return;
    setPending("start");
    setError(null);
    const replaceActive = Boolean(activePlan);
    try {
      await onStart(
        buildStartBlock(choice, {
          replaceActive,
          warningShown: warningShown.current,
          timezone: getDeviceTimezone(),
        }),
      );
      trackEvent("plan_started", {
        startOption: choice.kind,
        replacedActive: replaceActive,
        source: entry,
      });
      close("started");
    } catch (startError) {
      if (hasErrorCode(startError, "ACTIVE_PLAN_EXISTS")) {
        setConflictActive(activePlanFromError(startError));
        void activeQuery.refetch();
      } else if (hasErrorCode(startError, "PLAN_START_DATE_INVALID")) {
        setError(startCopy.dateInvalid);
        setChoice(null);
        if (isDraft) void optionsQuery.refetch();
      } else {
        setError(planErrorMessage(startError, copy, startCopy.failed));
      }
    } finally {
      setPending(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft || pending) return;
    setPending("draft");
    setError(null);
    try {
      await onSaveDraft();
      close("draft");
    } catch (saveError) {
      setError(planErrorMessage(saveError, copy));
    } finally {
      setPending(null);
    }
  };

  const today = options?.today;
  const customDate = choice?.kind === "custom" ? choice.startDate : null;

  const optionLabel = (option: PlanStartOption): string => {
    const date = formatDayMonth(option.startDate, language);
    if (option.kind === "today") return fillTemplate(startCopy.today, { date });
    if (option.kind === "next_monday") return fillTemplate(startCopy.nextMonday, { date });
    return fillTemplate(startCopy.raceAligned, {
      race: option.goalTargetDate ? formatDayMonth(option.goalTargetDate, language) : "—",
      date,
    });
  };

  const raceReason = (option: PlanStartOption): string | null => {
    if (option.kind !== "race_aligned" || isOptionSelectable(option)) return null;
    if (option.reason === "target_date_passed") return startCopy.raceDatePassed;
    return fillTemplate(startCopy.raceNotFits, {
      available: option.weeksAvailable ?? 0,
      total: options?.totalWeeks ?? 0,
    });
  };

  const loading = isDraft && optionsQuery.isLoading;
  const loadFailed = isDraft && optionsQuery.isError;

  return (
    <BottomSheet
      title={fillTemplate(startCopy.title, { name: planName })}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        const next = result.current;
        const then = afterClose.current;
        result.current = null;
        afterClose.current = null;
        if (!next && activePlan && !then) trackEvent("plan_start_replace_declined");
        onClose(next);
        then?.();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={plansUiStyles.sheetScroll}
        contentContainerStyle={plansUiStyles.sheetContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activePlan ? (
          <SheetBlock theme={theme}>
            <ActivePlanWarning activePlan={activePlan} copy={copy} language={language} theme={theme} />
          </SheetBlock>
        ) : null}

        <SheetBlock theme={theme}>
          <View style={styles.options}>
            <SheetSectionLabel text={startCopy.when.toUpperCase()} theme={theme} />
            {loading ? (
              <Text style={[styles.muted, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
                …
              </Text>
            ) : null}
            {loadFailed ? (
              <Notice
                theme={theme}
                action={{ label: copy.plans.errors.retry, onPress: () => void optionsQuery.refetch() }}
              >
                {startCopy.loadFailed}
              </Notice>
            ) : null}

            {options?.options.map((option) => {
              const selectable = isOptionSelectable(option);
              const selected = choice?.kind === option.kind;
              const reason = raceReason(option);
              const recommended = option.kind === options.recommended && selectable;
              return (
                <View key={option.kind} style={styles.optionBlock}>
                  <RadioRow
                    label={optionLabel(option)}
                    meta={fillTemplate(startCopy.until, { date: formatDayMonth(option.endDate, language) })}
                    badge={recommended ? startCopy.recommended : undefined}
                    selected={selected}
                    disabled={!selectable}
                    accessibilityHint={reason ?? undefined}
                    onPress={() =>
                      setChoice({ kind: option.kind, startDate: option.startDate, goalTargetDate: option.goalTargetDate })
                    }
                    theme={theme}
                  />
                  {reason ? (
                    <View style={styles.reason}>
                      <Text
                        style={[styles.muted, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}
                      >
                        {reason}
                      </Text>
                      {isDraft && option.reason !== "target_date_passed" ? (
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() =>
                            setRaceDateEditor(option.goalTargetDate ?? addDaysIso(options.today, options.totalWeeks * 7))
                          }
                        >
                          <Text style={[styles.link, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.semibold }]}>
                            {startCopy.changeDate}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  {raceDateEditor && option.kind === "race_aligned" ? (
                    <View style={styles.wheelBlock}>
                      <DateWheel
                        value={raceDateEditor}
                        onChange={setRaceDateEditor}
                        minDate={options.today}
                        monthNames={copy.plan.creation.datePicker.months}
                        accessibilityLabel={startCopy.raceDateTitle}
                        theme={theme}
                        themeMode={themeMode}
                      />
                      <SheetButton
                        label={startCopy.apply}
                        variant="secondary"
                        onPress={() => {
                          setGoalTargetDate(raceDateEditor);
                          setRaceDateEditor(null);
                        }}
                        theme={theme}
                        themeMode={themeMode}
                        style={plansUiStyles.columnButton}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}

            {options && today ? (
              <View style={styles.optionBlock}>
                <RadioRow
                  label={startCopy.custom}
                  meta={
                    customDate
                      ? `${formatDayMonth(customDate, language)} · ${fillTemplate(startCopy.until, {
                          date: formatDayMonth(planEndDate(customDate, options.totalWeeks), language),
                        })}`
                      : undefined
                  }
                  selected={choice?.kind === "custom"}
                  onPress={() => setChoice({ kind: "custom", startDate: customDate ?? today })}
                  theme={theme}
                />
                {choice?.kind === "custom" ? (
                  <DateWheel
                    value={choice.startDate}
                    onChange={(next) =>
                      setChoice({ kind: "custom", startDate: clampIso(next, today, addDaysIso(today, CUSTOM_RANGE_DAYS)) })
                    }
                    minDate={today}
                    monthNames={copy.plan.creation.datePicker.months}
                    accessibilityLabel={startCopy.custom}
                    theme={theme}
                    themeMode={themeMode}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </SheetBlock>

        {isDraft && options?.metricsStale && onUpdateMetrics ? (
          <SheetBlock theme={theme}>
            <Notice
              theme={theme}
              action={{
                label: copy.plans.details.staleBanner,
                onPress: () => close(null, onUpdateMetrics),
              }}
            >
              {startCopy.staleMetrics}
            </Notice>
          </SheetBlock>
        ) : null}

        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}

        <SheetBlock theme={theme}>
          <SheetActionsColumn>
            <SheetButton
              label={activePlan ? startCopy.ctaReplace : startCopy.cta}
              variant={activePlan ? "destructive" : "primary"}
              onPress={() => void handleStart()}
              disabled={!choice || pending === "draft"}
              pending={pending === "start"}
              theme={theme}
              themeMode={themeMode}
              style={plansUiStyles.columnButton}
            />
            {mode === "creation" && onSaveDraft ? (
              <SheetButton
                label={startCopy.saveDraft}
                variant={activePlan ? "primary" : "secondary"}
                onPress={() => void handleSaveDraft()}
                disabled={pending === "start"}
                pending={pending === "draft"}
                theme={theme}
                themeMode={themeMode}
                style={plansUiStyles.columnButton}
              />
            ) : null}
            {activePlan ? (
              <SheetButton
                label={startCopy.dontStart}
                variant="secondary"
                onPress={() => close(null)}
                disabled={pending !== null}
                theme={theme}
                themeMode={themeMode}
                style={plansUiStyles.columnButton}
              />
            ) : null}
          </SheetActionsColumn>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

function RadioRow({
  label,
  meta,
  badge,
  selected,
  disabled = false,
  accessibilityHint,
  onPress,
  theme,
}: {
  label: string;
  meta?: string;
  badge?: string;
  selected: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={[label, meta, badge].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.radioRow,
        { backgroundColor: theme.color.control, opacity: disabled ? 0.5 : 1 },
        pressed && plansUiStyles.pressed,
      ]}
    >
      <View style={[styles.radioOuter, { borderColor: selected ? theme.color.primary : theme.color.border }]}>
        {selected ? <View style={[styles.radioInner, { backgroundColor: theme.color.primary }]} /> : null}
      </View>
      <View style={styles.radioText}>
        <Text style={[styles.radioLabel, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
          {label}
        </Text>
        {meta ? (
          <Text style={[styles.muted, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
            {meta}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <Text style={[styles.badge, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.semibold }]}>
          {badge}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: 10,
  },
  optionBlock: {
    gap: 8,
  },
  reason: {
    gap: 4,
    paddingHorizontal: 16,
  },
  wheelBlock: {
    gap: 12,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioText: {
    flex: 1,
    gap: 2,
  },
  radioLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  badge: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    fontSize: 13,
    lineHeight: 18,
  },
});
