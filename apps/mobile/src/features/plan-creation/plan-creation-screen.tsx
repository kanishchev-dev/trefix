import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AlertCircle, ChevronLeft } from "lucide-react-native";

import { type ManualPlanPreview } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../locales";
import { BottomSheet, SheetButton, useSheetStack } from "../../shared/ui/bottom-sheet";
import {
  MANUAL_PLAN_MAX_SESSIONS,
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_SESSIONS,
  MANUAL_PLAN_MIN_WEEKS,
  PLAN_FOCUS_OPTIONS,
  PLAN_GOAL_OPTIONS,
  PLAN_WORKOUT_DURATION_OPTIONS,
  formatTargetTime,
  parseTargetTime,
  validateTargetTime,
  type PlanCreationDraft,
} from "./plan-creation-types";
import { useManualPlanPreview } from "./hooks/use-manual-plan";
import {
  CounterRow,
  DayPicker,
  FieldError,
  OptionChip,
  SectionBlock,
} from "./components/plan-creation-ui";
import { PlanPreviewScreen } from "./plan-preview-screen";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onClose: () => void;
  onOpenTrefix: () => void;
};

type StepKey = "goal" | "schedule" | "structure";

const STEPS: StepKey[] = ["goal", "schedule", "structure"];

const INITIAL_DRAFT: PlanCreationDraft = {
  goal: {
    raceDistance: "10k",
    targetTimeText: "",
    targetTimeSeconds: undefined,
    targetDate: undefined,
  },
  schedule: {
    trainingDays: [0, 2, 5],
    preferredLongRunDay: undefined,
    workoutDurationMinutes: 45,
  },
  structure: {
    totalWeeks: 8,
    sessionsPerWeek: 3,
    focus: ["easy", "long_run", "tempo"],
  },
};

type StepOption = {
  value: PlanCreationDraft["goal"]["raceDistance"];
  label: string;
};

type StepMutationState = {
  isPending: boolean;
  isError: boolean;
};

export function PlanCreationScreen({
  theme,
  themeMode,
  copy,
  language,
  onClose,
}: Props) {
  const creationCopy = copy.plan.creation;

  const [sheetVisible, setSheetVisible] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<PlanCreationDraft>(INITIAL_DRAFT);
  const [preview, setPreview] = useState<ManualPlanPreview | null>(null);
  const [pendingPreview, setPendingPreview] = useState<ManualPlanPreview | null>(null);

  const previewMutation = useManualPlanPreview();

  const step = STEPS[stepIndex];

  const shortDayNames = useMemo(
    () =>
      language === "ru"
        ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    [language],
  );

  const goalOptions = useMemo<StepOption[]>(
    () =>
      PLAN_GOAL_OPTIONS.map((option) => ({
        value: option.value,
        label:
          option.labelKey === "5K" || option.labelKey === "10K"
            ? option.labelKey
            : creationCopy.goals[option.labelKey as keyof typeof creationCopy.goals],
      })),
    [creationCopy.goals],
  );

  const parsedTargetTime = draft.goal.targetTimeText.trim()
    ? parseTargetTime(draft.goal.targetTimeText)
    : null;

  const targetTimeError = useMemo(() => {
    if (draft.goal.targetTimeText.trim() && parsedTargetTime === null) {
      return "invalidTargetTime";
    }
    return validateTargetTime(draft.goal.raceDistance, parsedTargetTime);
  }, [draft.goal.targetTimeText, draft.goal.raceDistance, parsedTargetTime]);

  const isStepValid = useMemo(() => {
    if (step === "goal") {
      return targetTimeError === null;
    }
    if (step === "schedule") {
      return draft.schedule.trainingDays.length > 0;
    }
    return (
      draft.structure.sessionsPerWeek >= MANUAL_PLAN_MIN_SESSIONS &&
      draft.schedule.trainingDays.length > 0 &&
      draft.structure.totalWeeks >= MANUAL_PLAN_MIN_WEEKS &&
      draft.structure.totalWeeks <= MANUAL_PLAN_MAX_WEEKS
    );
  }, [draft, step, targetTimeError]);

  // Cancel closes the whole flow immediately (same as the workout sheets);
  // the animated exit happens inside the stack sheet.
  const requestClose = useCallback(() => {
    setPendingPreview(null);
    setSheetVisible(false);
  }, []);

  const handleFlowClosed = useCallback(() => {
    if (pendingPreview) {
      setPreview(pendingPreview);
      setPendingPreview(null);
      return;
    }
    onClose();
  }, [onClose, pendingPreview]);

  const requestPreview = useCallback(async () => {
    const targetTimeSeconds = parsedTargetTime ?? undefined;
    const nextDraft: PlanCreationDraft = {
      ...draft,
      goal: {
        ...draft.goal,
        targetTimeSeconds,
      },
    };

    setDraft(nextDraft);

    try {
      const result = await previewMutation.mutateAsync({
        goal: {
          raceDistance: nextDraft.goal.raceDistance,
          targetTimeSeconds,
          targetDate: nextDraft.goal.targetDate,
        },
        schedule: nextDraft.schedule,
        structure: nextDraft.structure,
      });

      setPendingPreview(result);
      setSheetVisible(false);
    } catch {
      // The sheet stays open and the inline error state will surface.
    }
  }, [draft, parsedTargetTime, previewMutation]);

  const handleContinue = useCallback(() => {
    if (!isStepValid) {
      return;
    }

    if (stepIndex < STEPS.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }

    void requestPreview();
  }, [isStepValid, requestPreview, stepIndex]);

  const toggleDay = useCallback(
    (dayIndex: number) => {
      setDraft((current) => {
        const selected = current.schedule.trainingDays.includes(dayIndex);
        const trainingDays = selected
          ? current.schedule.trainingDays.filter((day) => day !== dayIndex)
          : [...current.schedule.trainingDays, dayIndex].sort((a, b) => a - b);

        const preferredLongRunDay =
          current.schedule.preferredLongRunDay !== undefined &&
          trainingDays.includes(current.schedule.preferredLongRunDay)
            ? current.schedule.preferredLongRunDay
            : undefined;

        return {
          ...current,
          schedule: { ...current.schedule, trainingDays, preferredLongRunDay },
          structure: {
            ...current.structure,
            sessionsPerWeek: Math.min(
              current.structure.sessionsPerWeek,
              Math.max(trainingDays.length, 1),
            ),
          },
        };
      });
    },
    [],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (preview) {
        setPreview(null);
        setStepIndex(0);
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [preview]);

  if (preview) {
    return (
      <PlanPreviewScreen
        theme={theme}
        themeMode={themeMode}
        copy={copy}
        language={language}
        preview={preview}
        draft={draft}
        onEditSettings={() => {
          setPreview(null);
          setSheetVisible(true);
          setStepIndex(0);
        }}
        onDiscard={onClose}
        onCreated={onClose}
      />
    );
  }

  const visibleLayers = STEPS.slice(0, stepIndex + 1);

  return (
    <View style={styles.root} pointerEvents="none">
      <BottomSheet
        mode="stack"
        visible={sheetVisible}
        onClose={handleFlowClosed}
        onStackPop={() => setStepIndex((current) => Math.max(current - 1, 0))}
        onDismissRequest={requestClose}
        layerTitles={visibleLayers.map((stepKey) => copy.plan.creation.steps[stepKey].title)}
        theme={theme}
        themeMode={themeMode}
      >
        {visibleLayers.map((stepKey) => (
          <PlanCreationStepLayer
            key={stepKey}
            stepKey={stepKey}
            isActive={stepKey === step}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
            draft={draft}
            onDraftChange={setDraft}
            onToggleDay={toggleDay}
            goalOptions={goalOptions}
            shortDayNames={shortDayNames}
            targetTimeError={targetTimeError}
            isStepValid={isStepValid}
            previewMutation={{
              isPending: previewMutation.isPending,
              isError: previewMutation.isError,
            }}
            onContinue={handleContinue}
            onCancelRequest={requestClose}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

function PlanCreationStepLayer({
  stepKey,
  isActive,
  theme,
  themeMode,
  copy,
  language,
  draft,
  onDraftChange,
  onToggleDay,
  goalOptions,
  shortDayNames,
  targetTimeError,
  isStepValid,
  previewMutation,
  onContinue,
  onCancelRequest,
}: {
  stepKey: StepKey;
  isActive: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  draft: PlanCreationDraft;
  onDraftChange: React.Dispatch<React.SetStateAction<PlanCreationDraft>>;
  onToggleDay: (dayIndex: number) => void;
  goalOptions: StepOption[];
  shortDayNames: readonly string[];
  targetTimeError: string | null;
  isStepValid: boolean;
  previewMutation: StepMutationState;
  onContinue: () => void;
  onCancelRequest: () => void;
}) {
  const { pop } = useSheetStack();
  const creationCopy = copy.plan.creation;
  const stepCopy = creationCopy.steps[stepKey];
  const stepIndex = STEPS.indexOf(stepKey);
  const isLastStep = stepKey === "structure";  return (
    <View style={styles.stepLayerRoot}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.stepQuestion,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {stepCopy.question}
        </Text>

        {stepKey === "goal" ? (
          <>
            <SectionBlock title={creationCopy.goalSection} theme={theme}>
              <View style={styles.chipWrap}>
                {goalOptions.map((option) => (
                  <OptionChip
                    key={option.value}
                    label={option.label}
                    selected={draft.goal.raceDistance === option.value}
                    theme={theme}
                    onPress={() =>
                      onDraftChange((current) => ({
                        ...current,
                        goal: { ...current.goal, raceDistance: option.value },
                      }))
                    }
                  />
                ))}
              </View>
            </SectionBlock>

            <SectionBlock title={creationCopy.targetTimeSection} theme={theme}>
              <View style={styles.targetTimeRow}>
                {["45:00", "1:45:00", "4:00:00"].map((preset) => (
                  <OptionChip
                    key={preset}
                    label={preset}
                    selected={
                      draft.goal.targetTimeText === preset ||
                      (parseTargetTime(draft.goal.targetTimeText) !== null &&
                        formatTargetTime(parseTargetTime(draft.goal.targetTimeText) ?? 0) === preset &&
                        draft.goal.targetTimeText === preset)
                    }
                    theme={theme}
                    onPress={() =>
                      onDraftChange((current) => ({
                        ...current,
                        goal: { ...current.goal, targetTimeText: preset },
                      }))
                    }
                  />
                ))}
              </View>
              <TextInput
                accessibilityLabel={creationCopy.targetTimeSection}
                keyboardType="numbers-and-punctuation"
                placeholder={creationCopy.targetTimePlaceholder}
                placeholderTextColor={theme.color.mutedForeground}
                value={draft.goal.targetTimeText}
                onChangeText={(text: string) =>
                  onDraftChange((current) => ({
                    ...current,
                    goal: { ...current.goal, targetTimeText: text },
                  }))
                }
                style={[
                  styles.timeInput,
                  {
                    backgroundColor: theme.color.surfaceElevated,
                    borderColor: targetTimeError ? "#dc2626" : theme.color.border,
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.semibold,
                  },
                ]}
              />
              {targetTimeError ? (
                <FieldError
                  message={creationCopy.errors[targetTimeError as keyof typeof creationCopy.errors]}
                  theme={theme}
                />
              ) : null}
            </SectionBlock>

            <SectionBlock title={creationCopy.targetDateSection} theme={theme}>
              <View style={styles.targetTimeRow}>
                {[7, 14, 21].map((daysAhead) => {
                  const date = new Date();
                  date.setDate(date.getDate() + daysAhead);
                  const iso = date.toISOString().slice(0, 10);
                  const label = date.toLocaleDateString(language === "ru" ? "ru-RU" : "en-US", {
                    day: "numeric",
                    month: "short",
                  });

                  return (
                    <OptionChip
                      key={daysAhead}
                      label={label}
                      selected={draft.goal.targetDate === iso}
                      theme={theme}
                      onPress={() =>
                        onDraftChange((current) => ({
                          ...current,
                          goal: {
                            ...current.goal,
                            targetDate: current.goal.targetDate === iso ? undefined : iso,
                          },
                        }))
                      }
                    />
                  );
                })}
              </View>
            </SectionBlock>
          </>
        ) : null}

        {stepKey === "schedule" ? (
          <>
            <SectionBlock title={creationCopy.trainingDaysSection} theme={theme}>
              <DayPicker
                selectedDays={draft.schedule.trainingDays}
                theme={theme}
                shortDayNames={shortDayNames}
                onToggleDay={onToggleDay}
              />
              <Text
                style={[
                  styles.dayCountText,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {creationCopy.sessionsPerWeekText.replace(
                  "{{count}}",
                  String(draft.schedule.trainingDays.length),
                )}
              </Text>
            </SectionBlock>

            <SectionBlock title={creationCopy.longRunSection} theme={theme}>
              <View style={styles.chipWrap}>
                {draft.schedule.trainingDays.map((dayIndex) => (
                  <OptionChip
                    key={dayIndex}
                    label={shortDayNames[dayIndex]}
                    selected={draft.schedule.preferredLongRunDay === dayIndex}
                    theme={theme}
                    onPress={() =>
                      onDraftChange((current) => ({
                        ...current,
                        schedule: {
                          ...current.schedule,
                          preferredLongRunDay:
                            current.schedule.preferredLongRunDay === dayIndex ? undefined : dayIndex,
                        },
                      }))
                    }
                  />
                ))}
              </View>
            </SectionBlock>

            <SectionBlock title={creationCopy.durationSection} theme={theme}>
              <View style={styles.chipWrap}>
                {PLAN_WORKOUT_DURATION_OPTIONS.map((minutes) => (
                  <OptionChip
                    key={minutes}
                    label={`${minutes} min`}
                    selected={draft.schedule.workoutDurationMinutes === minutes}
                    theme={theme}
                    onPress={() =>
                      onDraftChange((current) => ({
                        ...current,
                        schedule: { ...current.schedule, workoutDurationMinutes: minutes },
                      }))
                    }
                  />
                ))}
              </View>
            </SectionBlock>
          </>
        ) : null}

        {stepKey === "structure" ? (
          <>
            <View style={styles.counterGroup}>
              <CounterRow
                label={creationCopy.weeksLabel}
                value={draft.structure.totalWeeks}
                suffix={creationCopy.weeksSuffix}
                min={MANUAL_PLAN_MIN_WEEKS}
                max={MANUAL_PLAN_MAX_WEEKS}
                theme={theme}
                onChange={(value) =>
                  onDraftChange((current) => ({
                    ...current,
                    structure: { ...current.structure, totalWeeks: value },
                  }))
                }
              />
              <CounterRow
                label={creationCopy.sessionsLabel}
                value={draft.structure.sessionsPerWeek}
                min={MANUAL_PLAN_MIN_SESSIONS}
                max={Math.max(draft.schedule.trainingDays.length, 1)}
                theme={theme}
                onChange={(value) =>
                  onDraftChange((current) => ({
                    ...current,
                    structure: { ...current.structure, sessionsPerWeek: value },
                  }))
                }
              />
            </View>

            <SectionBlock title={creationCopy.focusSection} theme={theme}>
              <View style={styles.chipWrap}>
                {PLAN_FOCUS_OPTIONS.map((focusKey) => (
                  <OptionChip
                    key={focusKey}
                    label={creationCopy.focusOptions[focusKey as keyof typeof creationCopy.focusOptions]}
                    selected={(draft.structure.focus ?? []).includes(focusKey)}
                    theme={theme}
                    onPress={() =>
                      onDraftChange((current) => {
                        const focus = current.structure.focus ?? [];
                        const nextFocus = focus.includes(focusKey)
                          ? focus.filter((item) => item !== focusKey)
                          : [...focus, focusKey];

                        return {
                          ...current,
                          structure: { ...current.structure, focus: nextFocus },
                        };
                      })
                    }
                  />
                ))}
              </View>
            </SectionBlock>
          </>
        ) : null}
      </ScrollView>

      {previewMutation.isError && isActive ? (
        <View style={styles.inlineErrorRow}>
          <AlertCircle color="#dc2626" size={14} />
          <Text
            style={[
              styles.inlineErrorText,
              { fontFamily: theme.typography.fontFamily.sans.regular },
            ]}
          >
            {creationCopy.errors.generationFailed}
          </Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {stepIndex > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={creationCopy.common.back}
            onPress={pop}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor:
                  themeMode === "dark" ? "#1a1a1e" : theme.color.secondary,
              },
              pressed && styles.pressed,
            ]}
          >
            <ChevronLeft color={theme.color.foreground} size={22} />
          </Pressable>
        ) : null}

        <SheetButton
          label={creationCopy.common.cancel}
          onPress={onCancelRequest}
          variant="secondary"
          theme={theme}
          themeMode={themeMode}
        />

        <SheetButton
          label={isLastStep ? creationCopy.common.buildPlan : creationCopy.common.continue}
          onPress={onContinue}
          disabled={!isStepValid}
          pending={previewMutation.isPending && isActive}
          theme={theme}
          themeMode={themeMode}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The screen only hosts the native Modal, so it must not take part in the
  // host layout: as a flex sibling it would squeeze the tab content and
  // expose the app background at the bottom half of the screen between the
  // method sheet closing and the stack opening.
  // (StyleSheet.absoluteFillObject is absent from this RN version's types.)
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  stepLayerRoot: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 4,
  },
  stepQuestion: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  targetTimeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  dayCountText: {
    fontSize: 13,
    lineHeight: 18,
  },
  counterGroup: {
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineErrorText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
