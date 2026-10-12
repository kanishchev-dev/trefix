import { type Dispatch, type SetStateAction } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AlertCircle, ChevronLeft } from "lucide-react-native";
import {
  type AthleteGoalType,
  type ManualPlanPreview,
  type MetricsSnapshot,
  type RebuildPreview,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Card } from "../../../shared/ui/card";
import {
  fillTemplate,
  formatShortDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  SheetBlock,
  SheetButton,
  useSheetStack,
} from "../../../shared/ui/bottom-sheet";
import {
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_WEEKS,
  PLAN_FOCUS_OPTIONS,
  formatTargetTime,
  type PlanCreationDraft,
} from "../plan-creation-types";
import { CirclePicker, OptionChip, SectionBlock } from "./plan-creation-ui";
import { Ruler } from "@trefix/ui-native";
import { GoalTypeStep } from "./goal-type-step";
import { GoalSetupStep } from "./goal-setup-step";
import { ScheduleStepFields } from "./schedule-step-fields";
import { CurrentMetricsStep } from "./current-metrics-step";
import { Notice } from "../../plans/components/plans-ui";
import {
  structureChanged,
  type MetricsErrors,
  type MetricsForm,
  type MetricsSources,
} from "../../plans/lib/plan-draft";
import { styles } from "../plan-creation-screen.styles";
import {
  STEPS,
  IMPROVE_PERCENT,
  type PlanCreationLaunch,
  type StepKey,
  type StepMutationState,
  type FlowSetup,
} from "../plan-creation-flow";

export type PreviewState =
  | { kind: "manual"; preview: ManualPlanPreview }
  | { kind: "rebuild"; data: RebuildPreview };

export type MetricsBinding = {
  form: MetricsForm;
  onChange: (updater: (current: MetricsForm) => MetricsForm) => void;
  sources: MetricsSources;
  previous: MetricsSnapshot | null;
  errors: MetricsErrors;
};

export function PlanCreationStepLayer({
  stepKey,
  isActive,
  theme,
  themeMode,
  copy,
  language,
  launchMode,
  draft,
  initialDraft,
  onDraftChange,
  onSelectGoalType,
  onToggleDay,
  shortDayNames,
  isStepValid,
  previewMutation,
  onContinue,
  onSkipMetrics,
  onCancelRequest,
  hints,
  metrics,
  onOpenIntegrations,
}: {
  stepKey: StepKey;
  isActive: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  launchMode: PlanCreationLaunch["mode"];
  draft: PlanCreationDraft;
  initialDraft: PlanCreationDraft;
  onDraftChange: Dispatch<SetStateAction<PlanCreationDraft>>;
  onSelectGoalType: (goalType: AthleteGoalType) => void;
  onToggleDay: (dayIndex: number) => void;
  shortDayNames: readonly string[];
  isStepValid: boolean;
  previewMutation: StepMutationState;
  onContinue: () => void;
  onSkipMetrics: () => void;
  onCancelRequest: () => void;
  hints: FlowSetup["hints"];
  metrics: MetricsBinding;
  onOpenIntegrations?: () => void;
}) {
  const { pop } = useSheetStack();
  const creationCopy = copy.plan.creation;
  const rebuildCopy = copy.plans.rebuild;
  const stepQuestion =
    stepKey === "metrics"
      ? copy.plans.metrics.question
      : creationCopy.steps[stepKey]?.question;
  const stepIndex = STEPS.indexOf(stepKey);
  const isLastStep = stepKey === "metrics";
  const isCreate = launchMode === "create";
  const previousResult = hints?.previousResultSeconds ?? null;

  return (
    <View style={styles.stepLayerRoot}>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {stepKey !== "goalType" && stepQuestion ? (
          <SheetBlock theme={theme}>
            {/* Step explanation: what is set here and how it affects the plan. */}
            <Card
              size="sm"
              theme={theme}
              themeMode={themeMode}
              style={styles.stepInfoCard}
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
                {stepQuestion}
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

        {stepKey === "goalSetup" &&
        hints &&
        (hints.previousTargetDate || previousResult) ? (
          <SheetBlock theme={theme}>
            <Notice
              theme={theme}
              action={
                previousResult
                  ? {
                      label: fillTemplate(rebuildCopy.improveGoal, {
                        percent: IMPROVE_PERCENT,
                      }),
                      // Display helper only: fills the target field, the plan is computed by the server.
                      onPress: () =>
                        onDraftChange((current) => ({
                          ...current,
                          goal: {
                            ...current.goal,
                            target: {
                              ...(current.goal.target ?? {}),
                              finishTimeSec: Math.round(
                                (previousResult * (100 - IMPROVE_PERCENT)) /
                                  100,
                              ),
                            },
                          },
                        })),
                    }
                  : undefined
              }
            >
              {[
                hints.previousTargetDate
                  ? fillTemplate(rebuildCopy.previousTargetDate, {
                      date: formatShortDate(hints.previousTargetDate, language),
                    })
                  : null,
                previousResult
                  ? fillTemplate(rebuildCopy.previousResult, {
                      time: formatTargetTime(previousResult),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Notice>
          </SheetBlock>
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
          <ScheduleStepFields
            schedule={draft.schedule}
            onToggleDay={onToggleDay}
            onChange={(updater) =>
              onDraftChange((current) => ({
                ...current,
                schedule: updater(current.schedule),
              }))
            }
            shortDayNames={shortDayNames}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
          />
        ) : null}

        {stepKey === "structure" ? (
          <>
            {!isCreate && structureChanged(initialDraft, draft) ? (
              <SheetBlock theme={theme}>
                <Notice tone="warning" theme={theme}>
                  {rebuildCopy.structureChangedWarning}
                </Notice>
              </SheetBlock>
            ) : null}

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
                  disabled:
                    count > Math.max(draft.schedule.trainingDays.length, 1),
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
                    label={
                      creationCopy.focusOptions[
                        focusKey as keyof typeof creationCopy.focusOptions
                      ]
                    }
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

        {stepKey === "metrics" ? (
          <CurrentMetricsStep
            form={metrics.form}
            onChange={metrics.onChange}
            sources={metrics.sources}
            previous={metrics.previous}
            showPrevious={!isCreate}
            errors={metrics.errors}
            onConnectStrava={onOpenIntegrations}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        ) : null}
      </ScrollView>

      {previewMutation.error && isActive ? (
        <SheetBlock theme={theme}>
          <View style={styles.inlineErrorRow}>
            <AlertCircle color={theme.color.danger} size={14} />
            <Text
              style={[
                styles.inlineErrorText,
                {
                  color: theme.color.danger,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {previewMutation.error}
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
                    backgroundColor: theme.color.controlSecondary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <ChevronLeft color={theme.color.foreground} size={22} />
              </Pressable>
            ) : null}

            {isLastStep && isCreate ? (
              <SheetButton
                label={copy.plans.metrics.skip}
                onPress={onSkipMetrics}
                variant="secondary"
                disabled={previewMutation.isPending}
                theme={theme}
                themeMode={themeMode}
              />
            ) : (
              <SheetButton
                label={creationCopy.common.cancel}
                onPress={onCancelRequest}
                variant="secondary"
                theme={theme}
                themeMode={themeMode}
              />
            )}

            <SheetButton
              label={
                isLastStep
                  ? creationCopy.common.buildPlan
                  : creationCopy.common.continue
              }
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
