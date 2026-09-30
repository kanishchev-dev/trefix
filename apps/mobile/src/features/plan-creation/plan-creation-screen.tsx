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

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../locales";
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
import type { ManualPlanPreview } from "@workspace/api-client";

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

export function PlanCreationScreen({
  theme,
  themeMode,
  copy,
  language,
  onClose,
  onOpenTrefix,
}: Props) {
  const creationCopy = copy.plan.creation;

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [preview, setPreview] = useState<ManualPlanPreview | null>(null);
  const [draft, setDraft] = useState<PlanCreationDraft>({
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
  });

  const previewMutation = useManualPlanPreview();

  const requestClose = useCallback(() => {
    // User is mid-flow — ask before discarding (PRD §21).
    setShowDiscardConfirm(true);
  }, []);

  // Android hardware back mirrors the on-screen close action at each stage.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
          return true;
        }
        if (preview) {
          setPreview(null);
          setStepIndex(0);
          return true;
        }
        if (stepIndex > 0) {
          setStepIndex(stepIndex - 1);
          return true;
        }
        requestClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [
    showDiscardConfirm,
    preview,
    stepIndex,
    requestClose,
  ]);

  const step = STEPS[stepIndex];

  const shortDayNames = useMemo(
    () =>
      language === "ru"
        ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    [language],
  );

  const goalOptions = useMemo(
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
  }, [step, targetTimeError, draft]);

  const requestPreview = async () => {
    const targetTimeSeconds = parsedTargetTime ?? undefined;
    setDraft((current) => ({
      ...current,
      goal: { ...current.goal, targetTimeSeconds },
    }));

    try {
      const result = await previewMutation.mutateAsync({
        goal: {
          raceDistance: draft.goal.raceDistance,
          targetTimeSeconds,
          targetDate: draft.goal.targetDate,
        },
        schedule: draft.schedule,
        structure: draft.structure,
      });
      setPreview(result);
    } catch {
      // Inline error is rendered below via previewMutation.isError.
    }
  };

  const handleContinue = () => {
    if (!isStepValid) {
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    void requestPreview();
  };

  const handleDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  const toggleDay = (dayIndex: number) => {
    setDraft((current) => {
      const selected = current.schedule.trainingDays.includes(dayIndex);
      const trainingDays = selected
        ? current.schedule.trainingDays.filter((day) => day !== dayIndex)
        : [...current.schedule.trainingDays, dayIndex].sort((a, b) => a - b);

      // Keep the preferred long run day consistent with selected days.
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
          // Sessions per week stays consistent with the selected days (PRD section 11).
          sessionsPerWeek: Math.min(
            current.structure.sessionsPerWeek,
            Math.max(trainingDays.length, 1),
          ),
        },
      };
    });
  };

  // --- Preview step ---
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
          setStepIndex(0);
        }}
        onDiscard={requestClose}
        onCreated={onClose}
      />
    );
  }

  const creationStepCopy = creationCopy.steps[step];

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      {/* Discard confirmation modal */}
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

      {/* Step content */}
      <View style={styles.header}>
        {stepIndex > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={creationCopy.common.back}
            hitSlop={8}
            onPress={() => setStepIndex(stepIndex - 1)}
            style={styles.backButton}
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
          <View style={styles.backButton} />
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
          {creationStepCopy.title}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={creationCopy.common.close}
          hitSlop={8}
          onPress={requestClose}
          style={styles.closeButton}
        >
          <X color={theme.color.mutedForeground} size={20} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === "goal" ? (
          <>
            <Text
              style={[
                styles.stepQuestion,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {creationStepCopy.question}
            </Text>

            <SectionBlock title={creationCopy.goalSection} theme={theme}>
              <View style={styles.chipWrap}>
                {goalOptions.map((option) => (
                  <OptionChip
                    key={option.value}
                    label={option.label}
                    selected={draft.goal.raceDistance === option.value}
                    theme={theme}
                    onPress={() =>
                      setDraft((current) => ({
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
                      (parsedTargetTime !== null &&
                        formatTargetTime(parsedTargetTime) === preset &&
                        draft.goal.targetTimeText === preset)
                    }
                    theme={theme}
                    onPress={() =>
                      setDraft((current) => ({
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
                  setDraft((current) => ({
                    ...current,
                    goal: { ...current.goal, targetTimeText: text },
                  }))
                }
                style={[
                  styles.timeInput,
                  {
                    backgroundColor: theme.color.surfaceElevated,
                    borderColor: targetTimeError
                      ? "#dc2626"
                      : theme.color.border,
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
                        setDraft((current) => ({
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

        {step === "schedule" ? (
          <>
            <Text
              style={[
                styles.stepQuestion,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {creationStepCopy.question}
            </Text>

            <SectionBlock title={creationCopy.trainingDaysSection} theme={theme}>
              <DayPicker
                selectedDays={draft.schedule.trainingDays}
                theme={theme}
                shortDayNames={shortDayNames}
                onToggleDay={toggleDay}
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
                      setDraft((current) => ({
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
                      setDraft((current) => ({
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

        {step === "structure" ? (
          <>
            <Text
              style={[
                styles.stepQuestion,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {creationStepCopy.question}
            </Text>

            <View style={styles.counterGroup}>
              <CounterRow
                label={creationCopy.weeksLabel}
                value={draft.structure.totalWeeks}
                suffix={creationCopy.weeksSuffix}
                min={MANUAL_PLAN_MIN_WEEKS}
                max={MANUAL_PLAN_MAX_WEEKS}
                theme={theme}
                onChange={(value) =>
                  setDraft((current) => ({
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
                  setDraft((current) => ({
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
                    label={
                      creationCopy.focusOptions[focusKey as keyof typeof creationCopy.focusOptions]
                    }
                    selected={(draft.structure.focus ?? []).includes(focusKey)}
                    theme={theme}
                    onPress={() =>
                      setDraft((current) => {
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

      {/* Footer */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: theme.color.border,
          },
        ]}
      >
        {previewMutation.isError ? (
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
            <Pressable
              accessibilityRole="button"
              onPress={() => void requestPreview()}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.inlineErrorRetry,
                  { fontFamily: theme.typography.fontFamily.sans.bold },
                ]}
              >
                {creationCopy.errors.tryAgain}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={!isStepValid || previewMutation.isPending}
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueButton,
            { backgroundColor: theme.color.primary, opacity: isStepValid ? 1 : 0.45 },
            pressed && styles.pressed,
          ]}
        >
          {previewMutation.isPending ? (
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
              {stepIndex < STEPS.length - 1 ? creationCopy.common.continue : creationCopy.common.buildPlan}
            </Text>
          )}
        </Pressable>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "flex-start",
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
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  stepQuestion: {
    fontSize: 15,
    lineHeight: 20,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  targetTimeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  timeInput: {
    height: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  dayCountText: {
    fontSize: 13,
    lineHeight: 18,
  },
  counterGroup: {
    gap: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  inlineErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineErrorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
  },
  inlineErrorRetry: {
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
  },
  continueButton: {
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    fontSize: 16,
    lineHeight: 22,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
