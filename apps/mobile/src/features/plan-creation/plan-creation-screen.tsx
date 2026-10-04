import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AlertCircle, ChevronLeft } from "lucide-react-native";

import {
  validateGoalPayload,
  type AthleteGoalType,
  type ManualPlanPreview,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Ruler } from "@workspace/ui-native";
import { Card } from "../../shared/ui/card";

import { type AppLanguage, type MainCopy } from "../../locales";
import { BottomSheet, SheetBlock, SheetButton, useSheetStack } from "../../shared/ui/bottom-sheet";
import {
  MANUAL_PLAN_MAX_DURATION_MINUTES,
  MANUAL_PLAN_MAX_SESSIONS,
  MANUAL_PLAN_MIN_DURATION_MINUTES,
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_SESSIONS,
  MANUAL_PLAN_MIN_WEEKS,
  PLAN_FOCUS_OPTIONS,
  pruneStaleGoalFields,
  withRequiredGoalDefaults,
  type PlanCreationDraft,
} from "./plan-creation-types";
import { useManualPlanPreview } from "./hooks/use-manual-plan";
import {
  CirclePicker,
  DayPicker,
  OptionChip,
  SectionBlock,
} from "./components/plan-creation-ui";
import { GoalTypeStep } from "./components/goal-type-step";
import { GoalSetupStep } from "./components/goal-setup-step";
import { PlanPreviewScreen } from "./plan-preview-screen";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onClose: () => void;
  onOpenTrefix: () => void;
};

type StepKey = "goalType" | "goalSetup" | "schedule" | "structure";

const STEPS: StepKey[] = ["goalType", "goalSetup", "schedule", "structure"];

const INITIAL_DRAFT: PlanCreationDraft = {
  goal: {
    type: "prepare_for_race",
    target: {
      distanceMeters: 10000,
    },
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

  const isStepValid = useMemo(() => {
    if (step === "goalType") {
      return Boolean(draft.goal.type);
    }
    if (step === "goalSetup") {
      if (draft.goal.type === "custom") {
        return Boolean(draft.goal.description?.trim());
      }
      // The draft already holds canonical metric keys; validate it as sent.
      const valResult = validateGoalPayload({
        type: draft.goal.type,
        target: draft.goal.target,
        current: draft.goal.current,
        description: draft.goal.description,
      });
      return valResult.valid;
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
  }, [step, draft]);

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

  const handleGoalTypeSelect = useCallback((newType: AthleteGoalType) => {
    setDraft((current) => ({
      ...current,
      // Another goal type starts from scratch: opened sections (current level,
      // target date) and optional fields are reset. Re-picking the same type keeps
      // what was entered. Required fields are pre-filled so shown = sent.
      goal:
        newType === current.goal.type
          ? withRequiredGoalDefaults(pruneStaleGoalFields(current.goal, newType))
          : withRequiredGoalDefaults({ type: newType }),
    }));
    setStepIndex(1);
  }, []);

  const requestPreview = useCallback(async () => {
    const goalPayload = {
      type: draft.goal.type,
      target: draft.goal.target,
      current: draft.goal.current,
      description: draft.goal.description,
      targetDate: draft.goal.targetDate,
      priority: draft.goal.priority,
    };

    try {
      const result = await previewMutation.mutateAsync({
        goal: goalPayload,
        schedule: draft.schedule,
        structure: draft.structure,
      });

      setPendingPreview(result);
      setSheetVisible(false);
    } catch {
      // Inline error will surface
    }
  }, [draft, previewMutation]);

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
        layerTitles={visibleLayers.map(
          (stepKey) => creationCopy.steps[stepKey]?.title ?? stepKey,
        )}
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
            onSelectGoalType={handleGoalTypeSelect}
            onToggleDay={toggleDay}
            shortDayNames={shortDayNames}
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
  onSelectGoalType,
  onToggleDay,
  shortDayNames,
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
  onSelectGoalType: (goalType: AthleteGoalType) => void;
  onToggleDay: (dayIndex: number) => void;
  shortDayNames: readonly string[];
  isStepValid: boolean;
  previewMutation: StepMutationState;
  onContinue: () => void;
  onCancelRequest: () => void;
}) {
  const { pop } = useSheetStack();
  const creationCopy = copy.plan.creation;
  const stepCopy = creationCopy.steps[stepKey];
  const stepIndex = STEPS.indexOf(stepKey);
  const isLastStep = stepKey === "structure";

  return (
    <View style={styles.stepLayerRoot}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {stepKey !== "goalType" && stepCopy?.question ? (
          <SheetBlock theme={theme}>
            {/* Step explanation: what is set here and how it affects the plan. */}
            <Card size="sm" theme={theme} themeMode={themeMode} style={styles.stepInfoCard}>
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
            </Card>
          </SheetBlock>
        ) : null}

        {stepKey === "goalType" ? (
          <GoalTypeStep
            selectedType={draft.goal.type}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            onSelectType={onSelectGoalType}
            onCancel={onCancelRequest}
          />
        ) : null}

        {stepKey === "goalSetup" ? (
          <GoalSetupStep
            goalType={draft.goal.type}
            draft={draft.goal}
            theme={theme}
            copy={copy}
            onChangeDraft={(updater) =>
              onDraftChange((current) => ({
                ...current,
                goal: updater(current.goal),
              }))
            }
          />
        ) : null}

        {stepKey === "schedule" ? (
          <>
            <SectionBlock
              title={creationCopy.trainingDaysSection}
              description={creationCopy.trainingDaysHint}
              theme={theme}
            >
              <DayPicker
                selectedDays={draft.schedule.trainingDays}
                theme={theme}
                themeMode={themeMode}
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

            <SectionBlock
              title={creationCopy.longRunSection}
              description={creationCopy.longRunHint}
              theme={theme}
            >
              {/* Same week row as training days; only training days can be picked. Tap again to clear. */}
              <DayPicker
                selectedDays={
                  draft.schedule.preferredLongRunDay !== undefined ? [draft.schedule.preferredLongRunDay] : []
                }
                disabledDays={[0, 1, 2, 3, 4, 5, 6].filter(
                  (day) => !draft.schedule.trainingDays.includes(day),
                )}
                theme={theme}
                themeMode={themeMode}
                shortDayNames={shortDayNames}
                onToggleDay={(dayIndex) =>
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
            </SectionBlock>

            <SectionBlock
              title={creationCopy.durationSection}
              description={creationCopy.durationHint}
              theme={theme}
            >
              <Ruler
                value={draft.schedule.workoutDurationMinutes ?? 45}
                onChange={(minutes) =>
                  onDraftChange((current) => ({
                    ...current,
                    schedule: { ...current.schedule, workoutDurationMinutes: minutes },
                  }))
                }
                min={MANUAL_PLAN_MIN_DURATION_MINUTES}
                max={MANUAL_PLAN_MAX_DURATION_MINUTES}
                step={5}
                majorEvery={15}
                labelEvery={30}
                unit={creationCopy.units.min}
                accessibilityLabel={creationCopy.durationSection}
                theme={theme}
                themeMode={themeMode}
              />
            </SectionBlock>
          </>
        ) : null}

        {stepKey === "structure" ? (
          <>
            <SectionBlock
              title={creationCopy.weeksLabel}
              description={creationCopy.weeksHint}
              theme={theme}
            >
              <Ruler
                value={draft.structure.totalWeeks}
                onChange={(value) =>
                  onDraftChange((current) => ({
                    ...current,
                    structure: { ...current.structure, totalWeeks: value },
                  }))
                }
                min={MANUAL_PLAN_MIN_WEEKS}
                max={MANUAL_PLAN_MAX_WEEKS}
                step={1}
                tickSpacing={24}
                majorEvery={4}
                labelEvery={4}
                unit={creationCopy.weeksSuffix}
                accessibilityLabel={creationCopy.weeksLabel}
                theme={theme}
                themeMode={themeMode}
              />
            </SectionBlock>

            <SectionBlock
              title={creationCopy.sessionsLabel}
              description={creationCopy.sessionsHint}
              theme={theme}
            >
              {/* Same round-button look as the weekday pickers; counts above the
                  number of training days are unavailable. */}
              <CirclePicker
                options={[1, 2, 3, 4, 5, 6, 7].map((count) => ({
                  value: count,
                  label: String(count),
                  disabled: count > Math.max(draft.schedule.trainingDays.length, 1),
                }))}
                selected={[draft.structure.sessionsPerWeek]}
                onPress={(value) =>
                  onDraftChange((current) => ({
                    ...current,
                    structure: { ...current.structure, sessionsPerWeek: value },
                  }))
                }
                theme={theme}
              />
            </SectionBlock>

            <SectionBlock
              title={creationCopy.focusSection}
              description={creationCopy.focusHint}
              theme={theme}
            >
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
        <SheetBlock theme={theme}>
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
        </SheetBlock>
      ) : null}

      {stepKey !== "goalType" ? (
        <SheetBlock theme={theme}>
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
                      theme.color.controlSecondary,
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
        </SheetBlock>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    // Vertical rhythm between blocks of a step; keep in sync with goal-setup-step.
    gap: 52,
    paddingTop: 72,
    paddingBottom: 84,
  },
  stepInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepQuestion: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  dayCountText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "transparent",
    paddingHorizontal: 20,
    paddingVertical: 16,
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
