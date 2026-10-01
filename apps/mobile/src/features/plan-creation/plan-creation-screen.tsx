import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AlertCircle, X } from "lucide-react-native";

import { type ManualPlanPreview } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../locales";
import { BottomSheet, useSheetStack } from "../../shared/ui/bottom-sheet";
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

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
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

  const requestClose = useCallback(() => {
    setShowDiscardConfirm(true);
  }, []);

  const handleDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
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
      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
        return true;
      }

      if (preview) {
        setPreview(null);
        setStepIndex(0);
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [preview, showDiscardConfirm]);

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
    <View style={styles.root}>
      <BottomSheet
        mode="stack"
        visible={sheetVisible}
        onClose={handleFlowClosed}
        onStackPop={() => setStepIndex((current) => Math.max(current - 1, 0))}
        onDismissRequest={requestClose}
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
            onCloseRequest={requestClose}
          />
        ))}
      </BottomSheet>

      <Modal
        visible={showDiscardConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDiscardConfirm(false)}
      >
        <View style={styles.selectorOverlay}>
          <View
            style={[
              styles.selectorCard,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.border,
              },
            ]}
          >
            <Text
              style={[
                styles.selectorTitle,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.extrabold,
                },
              ]}
            >
              {creationCopy.discard.title}
            </Text>
            <Text
              style={[
                styles.selectorSubtitle,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {creationCopy.discard.message}
            </Text>
            <View style={styles.discardButtons}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowDiscardConfirm(false)}
                style={({ pressed }) => [
                  styles.discardButton,
                  {
                    backgroundColor: theme.color.surface,
                    borderColor: theme.color.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.discardButtonText,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {creationCopy.discard.keepEditing}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleDiscard}
                style={({ pressed }) => [
                  styles.discardButton,
                  { backgroundColor: "#dc2626", borderColor: "#dc2626" },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.discardButtonText,
                    {
                      color: "#ffffff",
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {creationCopy.discard.discard}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  onCloseRequest,
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
  onCloseRequest: () => void;
}) {
  const { pop } = useSheetStack();
  const creationCopy = copy.plan.creation;
  const stepCopy = creationCopy.steps[stepKey];
  const stepIndex = STEPS.indexOf(stepKey);
  const isLastStep = stepKey === "structure";

  return (
    <View>
      <StepHeader
        title={stepCopy.title}
        showBack={stepIndex > 0}
        backLabel={creationCopy.common.back}
        closeLabel={creationCopy.common.close}
        theme={theme}
        onBack={stepIndex > 0 ? pop : undefined}
        onClose={onCloseRequest}
      />

      <ScrollView
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

      <StepFooter
        label={isLastStep ? creationCopy.common.buildPlan : creationCopy.common.continue}
        disabled={!isStepValid || (previewMutation.isPending && isActive)}
        pending={previewMutation.isPending && isActive}
        theme={theme}
        onPress={onContinue}
        errorRow={
          previewMutation.isError && isActive
            ? {
                message: creationCopy.errors.generationFailed,
                onRetry: onContinue,
                onRetryLabel: creationCopy.errors.tryAgain,
              }
            : null
        }
      />
    </View>
  );
}

function StepHeader({
  title,
  showBack,
  backLabel,
  closeLabel,
  theme,
  onBack,
  onClose,
}: {
  title: string;
  showBack: boolean;
  backLabel: string;
  closeLabel: string;
  theme: ThemeTokens;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.header}>
      {showBack && onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          onPress={onBack}
          style={styles.headerSideSlot}
        >
          <Text
            style={[
              styles.backButtonText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            ‹
          </Text>
        </Pressable>
      ) : (
        <View style={styles.headerSideSlot} />
      )}

      <Text
        style={[
          styles.stepTitle,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.extrabold,
          },
        ]}
      >
        {title}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        hitSlop={8}
        onPress={onClose}
        style={styles.headerSideSlot}
      >
        <X color={theme.color.mutedForeground} size={20} />
      </Pressable>
    </View>
  );
}

function StepFooter({
  label,
  disabled,
  pending,
  theme,
  onPress,
  errorRow,
}: {
  label: string;
  disabled: boolean;
  pending: boolean;
  theme: ThemeTokens;
  onPress: () => void;
  errorRow?: {
    message: string;
    onRetry: () => void;
    onRetryLabel: string;
  } | null;
}) {
  return (
    <View
      style={[
        styles.footer,
        {
          borderTopColor: theme.color.border,
        },
      ]}
    >
      {errorRow ? (
        <View style={styles.inlineErrorRow}>
          <AlertCircle color="#dc2626" size={14} />
          <Text
            style={[
              styles.inlineErrorText,
              { fontFamily: theme.typography.fontFamily.sans.regular },
            ]}
          >
            {errorRow.message}
          </Text>
          <Pressable accessibilityRole="button" onPress={errorRow.onRetry} hitSlop={8}>
            <Text
              style={[
                styles.inlineErrorRetry,
                { fontFamily: theme.typography.fontFamily.sans.bold },
              ]}
            >
              {errorRow.onRetryLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.continueButton,
          { backgroundColor: theme.color.primary, opacity: disabled ? 0.45 : 1 },
          pressed && styles.pressed,
        ]}
      >
        {pending ? (
          <ActivityIndicator color={theme.color.primaryForeground} />
        ) : (
          <Text
            style={[
              styles.continueButtonText,
              {
                color: theme.color.primaryForeground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  selectorOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  selectorCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16,
  },
  selectorTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  selectorSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -8,
  },
  discardButtons: {
    flexDirection: "row",
    gap: 12,
  },
  discardButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  discardButtonText: {
    fontSize: 15,
    lineHeight: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  headerSideSlot: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 34,
  },
  stepTitle: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
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
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    gap: 12,
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
  inlineErrorRetry: {
    fontSize: 12,
    lineHeight: 16,
    color: "#dc2626",
  },
  continueButton: {
    borderRadius: 18,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
