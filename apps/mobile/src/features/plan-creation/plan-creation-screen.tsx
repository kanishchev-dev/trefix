import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ActivityIndicator,
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
  type MetricsSnapshot,
  type PlanDetails,
  type RebuildPreview,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { Card } from "../../shared/ui/card";
import { fillTemplate, formatShortDate, type AppLanguage, type MainCopy } from "../../locales";
import { trackEvent } from "../../lib/analytics";
import { BottomSheet, SheetBlock, SheetButton, useSheetStack } from "../../shared/ui/bottom-sheet";
import {
  INITIAL_PLAN_CREATION_DRAFT,
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_SESSIONS,
  MANUAL_PLAN_MIN_WEEKS,
  PLAN_FOCUS_OPTIONS,
  formatTargetTime,
  pruneStaleGoalFields,
  withRequiredGoalDefaults,
  type PlanCreationDraft,
} from "./plan-creation-types";
import { useCreateManualPlan, useManualPlanPreview } from "./hooks/use-manual-plan";
import { CirclePicker, OptionChip, SectionBlock } from "./components/plan-creation-ui";
import { Ruler } from "@workspace/ui-native";
import { GoalTypeStep } from "./components/goal-type-step";
import { GoalSetupStep } from "./components/goal-setup-step";
import { ScheduleStepFields, toggleTrainingDay } from "./components/schedule-step-fields";
import { CurrentMetricsStep } from "./components/current-metrics-step";
import { shortDayNamesFor } from "./components/workout-edit-form";
import { PlanPreviewScreen, type PreviewOutcome, type PreviewSubmission } from "./plan-preview-screen";
import { toDraftWeekOverrides, toManualWeekOverrides } from "./preview-edits";
import { usePlanDetails } from "../plans/hooks/use-plan";
import { useCurrentMetrics, useRebuildPlan, useRebuildPrefill, useRebuildPreview } from "../plans/hooks/use-plan-rebuild";
import { Notice } from "../plans/components/plans-ui";
import { daysBetween, getDeviceTimezone, todayIso } from "../plans/lib/plan-dates";
import {
  draftFromConfig,
  goalPayload,
  metricsFormFromCurrent,
  metricsPayload,
  structureChanged,
  validateMetricsForm,
  type MetricsErrors,
  type MetricsForm,
  type MetricsSources,
} from "../plans/lib/plan-draft";
import { hasErrorCode, planErrorMessage } from "../plans/lib/plan-errors";
import { saveFieldsFor } from "../plans/lib/start-plan";

/** How the creation flow is opened. */
export type PlanCreationLaunch =
  | { mode: "create" }
  /** "Prepare again" from a completed or cancelled plan. */
  | { mode: "rebuild"; sourcePlanId: string }
  /** New parameters / metrics for a stored draft; optionally straight on the metrics step. */
  | { mode: "draft-params"; planId: string; initialStep?: "metrics" };

export type PlanCreationOutcome =
  | { kind: "started"; name: string }
  | { kind: "draft"; planId: string | null; name: string }
  | { kind: "updated"; planId: string };

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  launch?: PlanCreationLaunch;
  onClose: () => void;
  onOpenTrefix: () => void;
  /** Called after the plan is saved or started; the flow is closed by the host. */
  onCompleted?: (outcome: PlanCreationOutcome) => void;
  /** Opens the integrations screen (Strava hint on the metrics step). */
  onOpenIntegrations?: () => void;
};

type StepKey = "goalType" | "goalSetup" | "schedule" | "structure" | "metrics";

const STEPS: StepKey[] = ["goalType", "goalSetup", "schedule", "structure", "metrics"];

const IMPROVE_PERCENT = 5;

type StepMutationState = {
  isPending: boolean;
  error: string | null;
};

type FlowSetup = {
  initialDraft: PlanCreationDraft;
  metrics: { form: MetricsForm; sources: MetricsSources };
  previousMetrics: MetricsSnapshot | null;
  hints: { previousTargetDate: string | null; previousResultSeconds: number | null } | null;
  initialStepIndex: number;
  defaultName?: string;
  initialNotes?: string | null;
  source?: PlanDetails;
};

export function PlanCreationScreen(props: Props) {
  const launch = props.launch ?? { mode: "create" };
  if (launch.mode === "create") return <NewPlanFlow {...props} />;
  return <PrefilledPlanFlow {...props} launch={launch} />;
}

/** Plain creation: defaults plus the current form estimate for the optional metrics step. */
function NewPlanFlow(props: Props) {
  const metricsQuery = useCurrentMetrics();
  const setup = useMemo<FlowSetup>(
    () => ({
      initialDraft: INITIAL_PLAN_CREATION_DRAFT,
      metrics: metricsFormFromCurrent(metricsQuery.data),
      previousMetrics: null,
      hints: null,
      initialStepIndex: 0,
    }),
    [metricsQuery.data],
  );
  return <PlanCreationFlow {...props} launch={{ mode: "create" }} setup={setup} />;
}

/** Rebuild and draft parameters: every step is prefilled from the stored plan. */
function PrefilledPlanFlow(props: Props & { launch: Exclude<PlanCreationLaunch, { mode: "create" }> }) {
  const { launch, theme, copy, onClose } = props;
  const planId = launch.mode === "rebuild" ? launch.sourcePlanId : launch.planId;
  const prefillQuery = useRebuildPrefill(planId);
  const detailsQuery = usePlanDetails(planId);
  const tracked = useRef(false);

  const setup = useMemo<FlowSetup | null>(() => {
    const prefill = prefillQuery.data;
    const details = detailsQuery.data;
    if (!prefill || !details) return null;
    const isRebuild = launch.mode === "rebuild";
    const draft = draftFromConfig(prefill.config, {
      targetDate: isRebuild ? prefill.goalSuggestion.targetDate : undefined,
    });
    const year = (draft.goal.targetDate ?? todayIso()).slice(0, 4);
    return {
      initialDraft: draft,
      metrics: metricsFormFromCurrent(prefill.metrics.current),
      previousMetrics: prefill.metrics.previous ?? details.metricsSnapshot,
      hints: isRebuild
        ? {
            previousTargetDate: prefill.goalSuggestion.previousTargetDate,
            previousResultSeconds: prefill.goalSuggestion.previousResult?.timeSeconds ?? null,
          }
        : null,
      initialStepIndex: launch.mode === "draft-params" && launch.initialStep === "metrics" ? STEPS.length - 1 : 0,
      defaultName: isRebuild ? fillTemplate(copy.plans.rebuild.defaultName, { name: details.name, year }) : details.name,
      initialNotes: isRebuild ? null : details.notes,
      source: details,
    };
  }, [copy.plans.rebuild.defaultName, detailsQuery.data, launch, prefillQuery.data]);

  useEffect(() => {
    if (tracked.current || launch.mode !== "rebuild" || !detailsQuery.data) return;
    tracked.current = true;
    const details = detailsQuery.data;
    const reference = details.cancelledAt ?? details.endDate ?? details.updatedAt;
    trackEvent("plan_rebuild_started", {
      sourceStatus: details.status,
      sourceAgeDays: Math.max(0, daysBetween(reference.slice(0, 10), todayIso())),
    });
  }, [detailsQuery.data, launch.mode]);

  if (!setup) {
    const failed = prefillQuery.isError || detailsQuery.isError;
    return (
      <View style={[styles.root, styles.loadingOverlay]}>
        {failed ? (
          <Card size="sm" theme={theme} themeMode={props.themeMode} style={styles.loadingCard}>
            <Text style={[styles.stepQuestion, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
              {copy.plans.rebuild.loadFailed}
            </Text>
            <View style={styles.loadingActions}>
              <SheetButton label={copy.plan.creation.common.close} variant="secondary" onPress={onClose} theme={theme} themeMode={props.themeMode} />
              <SheetButton
                label={copy.plans.errors.retry}
                onPress={() => {
                  void prefillQuery.refetch();
                  void detailsQuery.refetch();
                }}
                theme={theme}
                themeMode={props.themeMode}
              />
            </View>
          </Card>
        ) : (
          <ActivityIndicator color={theme.color.foreground} />
        )}
      </View>
    );
  }

  return <PlanCreationFlow {...props} launch={launch} setup={setup} />;
}

function PlanCreationFlow({
  theme,
  themeMode,
  copy,
  language,
  launch,
  setup,
  onClose,
  onCompleted,
  onOpenIntegrations,
}: Props & { launch: PlanCreationLaunch; setup: FlowSetup }) {
  const creationCopy = copy.plan.creation;
  const isCreate = launch.mode === "create";

  const [sheetVisible, setSheetVisible] = useState(true);
  const [stepIndex, setStepIndex] = useState(setup.initialStepIndex);
  const [draft, setDraft] = useState<PlanCreationDraft>(setup.initialDraft);
  const [metricsForm, setMetricsForm] = useState<MetricsForm>(setup.metrics.form);
  const [metricsSkipped, setMetricsSkipped] = useState(false);
  const [metricsAttempted, setMetricsAttempted] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pendingPreview, setPendingPreview] = useState<PreviewState | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const createdPlanId = useRef<string | null>(null);
  const savedName = useRef<string>("");
  const metricsTouched = useRef(false);

  // The current form estimate may arrive after the flow opened; keep the user's input.
  useEffect(() => {
    if (!metricsTouched.current) setMetricsForm(setup.metrics.form);
  }, [setup.metrics.form]);

  const manualPreviewMutation = useManualPlanPreview();
  const rebuildPreviewMutation = useRebuildPreview();
  const createMutation = useCreateManualPlan();
  const rebuildMutation = useRebuildPlan();

  const step = STEPS[stepIndex];
  const shortDayNames = useMemo(() => shortDayNamesFor(language), [language]);
  const requireVolume = !isCreate;

  const metricsErrors = useMemo<MetricsErrors>(
    () => validateMetricsForm(metricsForm, { requireVolume }),
    [metricsForm, requireVolume],
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
    if (step === "structure") {
      return (
        draft.structure.sessionsPerWeek >= MANUAL_PLAN_MIN_SESSIONS &&
        draft.schedule.trainingDays.length > 0 &&
        draft.structure.totalWeeks >= MANUAL_PLAN_MIN_WEEKS &&
        draft.structure.totalWeeks <= MANUAL_PLAN_MAX_WEEKS
      );
    }
    return true;
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

  const requestPreview = useCallback(
    async (skipMetrics: boolean) => {
      setPreviewError(null);
      const metrics = skipMetrics ? undefined : metricsPayload(metricsForm);
      const timezone = getDeviceTimezone();
      try {
        if (launch.mode === "create") {
          const result = await manualPreviewMutation.mutateAsync({
            goal: goalPayload(draft),
            schedule: draft.schedule,
            structure: draft.structure,
            metrics,
            timezone,
          });
          setPendingPreview({ kind: "manual", preview: result });
        } else {
          const planId = launch.mode === "rebuild" ? launch.sourcePlanId : launch.planId;
          const result = await rebuildPreviewMutation.mutateAsync({
            planId,
            goal: goalPayload(draft),
            schedule: draft.schedule,
            structure: draft.structure,
            metrics: metrics ?? {},
            target: launch.mode === "rebuild" ? "new_draft" : "in_place",
            timezone,
          });
          const volumeScale = result.diff.summary.adjustments.find((item) => item.code === "VOLUME_SCALED")?.params?.k;
          trackEvent("plan_rebuild_previewed", {
            mode: result.mode,
            volumeScale: typeof volumeScale === "number" ? volumeScale : null,
          });
          setPendingPreview({ kind: "rebuild", data: result });
        }
        setMetricsSkipped(skipMetrics);
        setSheetVisible(false);
      } catch (error) {
        setPreviewError(
          hasErrorCode(error, "PLAN_METRICS_INVALID")
            ? copy.plans.metrics.invalid
            : planErrorMessage(error, copy, creationCopy.errors.generationFailed),
        );
      }
    },
    [copy, creationCopy.errors.generationFailed, draft, launch, manualPreviewMutation, metricsForm, rebuildPreviewMutation],
  );

  const handleContinue = useCallback(() => {
    if (!isStepValid) {
      return;
    }

    if (stepIndex < STEPS.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }

    setMetricsAttempted(true);
    if (Object.keys(metricsErrors).length > 0) return;
    void requestPreview(false);
  }, [isStepValid, metricsErrors, requestPreview, stepIndex]);

  const toggleDay = useCallback((dayIndex: number) => {
    setDraft((current) => {
      const schedule = toggleTrainingDay(current.schedule, dayIndex);
      return {
        ...current,
        schedule,
        structure: {
          ...current.structure,
          sessionsPerWeek: Math.min(current.structure.sessionsPerWeek, Math.max(schedule.trainingDays.length, 1)),
        },
      };
    });
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (preview) {
        setPreview(null);
        setSheetVisible(true);
        setStepIndex(0);
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [preview]);

  const handleSubmit = useCallback(
    async ({ edits, name, notes, decision }: PreviewSubmission) => {
      const metrics = metricsSkipped ? undefined : metricsPayload(metricsForm);
      savedName.current = name ?? setup.defaultName ?? "";

      if (launch.mode === "create") {
        if (!decision) return;
        const plan = await createMutation.mutateAsync({
          goal: {
            ...goalPayload(draft),
            raceDistance: draft.goal.raceDistance,
            targetTimeSeconds: draft.goal.targetTimeSeconds,
          },
          schedule: draft.schedule,
          structure: draft.structure,
          metrics,
          timezone: getDeviceTimezone(),
          weekOverrides: toManualWeekOverrides(edits),
          ...saveFieldsFor(decision, { name, notes }),
        });
        createdPlanId.current = plan.id;
        if (decision.kind === "draft") trackEvent("plan_saved_as_draft", { source: "manual" });
        return;
      }

      const planId = launch.mode === "rebuild" ? launch.sourcePlanId : launch.planId;
      const result = await rebuildMutation.mutateAsync({
        planId,
        goal: goalPayload(draft),
        schedule: draft.schedule,
        structure: draft.structure,
        metrics: metrics ?? {},
        target: launch.mode === "rebuild" ? "new_draft" : "in_place",
        weekOverrides: toDraftWeekOverrides(edits),
        expectedVersion: launch.mode === "draft-params" ? setup.source?.version : undefined,
        ...(decision ? saveFieldsFor(decision, { name, notes }) : {}),
      });
      createdPlanId.current = result.id;
      if (launch.mode === "rebuild") {
        trackEvent("plan_rebuild_saved", {
          saveAsDraft: decision?.kind === "draft",
          started: decision?.kind === "start",
        });
        if (decision?.kind === "draft") trackEvent("plan_saved_as_draft", { source: "rebuild" });
      }
    },
    [createMutation, draft, launch, metricsForm, metricsSkipped, rebuildMutation, setup.defaultName, setup.source?.version],
  );

  const handleCompleted = useCallback(
    (outcome: PreviewOutcome) => {
      if (outcome === "started") {
        onCompleted?.({ kind: "started", name: savedName.current });
      } else if (outcome === "draft") {
        onCompleted?.({ kind: "draft", planId: createdPlanId.current, name: savedName.current });
      } else if (launch.mode === "draft-params") {
        onCompleted?.({ kind: "updated", planId: launch.planId });
      }
      onClose();
    },
    [launch, onClose, onCompleted],
  );

  if (preview) {
    const backToSettings = () => {
      setPreview(null);
      setSheetVisible(true);
      setStepIndex(0);
    };
    if (preview.kind === "manual") {
      return (
        <PlanPreviewScreen
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
          mode="creation"
          preview={preview.preview}
          draft={draft}
          startOptions={preview.preview.startOptions ?? null}
          onEditSettings={backToSettings}
          onDiscard={onClose}
          onSubmit={handleSubmit}
          onCompleted={handleCompleted}
        />
      );
    }
    const isDraftParams = launch.mode === "draft-params";
    return (
      <PlanPreviewScreen
        theme={theme}
        themeMode={themeMode}
        copy={copy}
        language={language}
        mode={isDraftParams ? "draft-params" : "rebuild"}
        // A draft has no dates until it is started.
        preview={isDraftParams ? { ...preview.data.preview, startDate: "" } : preview.data.preview}
        draft={draft}
        diffInfo={{
          mode: preview.data.mode,
          diff: preview.data.diff,
          warnings: preview.data.warnings,
          metricsVolume: {
            before: setup.previousMetrics?.weeklyMileageKm ?? null,
            after: metricsSkipped ? null : metricsForm.weeklyMileageKm,
          },
        }}
        startOptions={preview.data.startOptions}
        initialName={setup.defaultName}
        initialNotes={setup.initialNotes}
        onEditSettings={backToSettings}
        onDiscard={onClose}
        onSubmit={handleSubmit}
        onCompleted={handleCompleted}
      />
    );
  }

  const visibleLayers = STEPS.slice(0, stepIndex + 1);
  const previewPending = manualPreviewMutation.isPending || rebuildPreviewMutation.isPending;

  return (
    <View style={styles.root} pointerEvents="none">
      <BottomSheet
        mode="stack"
        visible={sheetVisible}
        onClose={handleFlowClosed}
        onStackPop={() => setStepIndex((current) => Math.max(current - 1, 0))}
        onDismissRequest={requestClose}
        layerTitles={visibleLayers.map((stepKey) =>
          stepKey === "metrics" ? copy.plans.metrics.title : creationCopy.steps[stepKey]?.title ?? stepKey,
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
            launchMode={launch.mode}
            draft={draft}
            initialDraft={setup.initialDraft}
            onDraftChange={setDraft}
            onSelectGoalType={handleGoalTypeSelect}
            onToggleDay={toggleDay}
            shortDayNames={shortDayNames}
            isStepValid={isStepValid}
            previewMutation={{ isPending: previewPending, error: previewError }}
            onContinue={handleContinue}
            onSkipMetrics={() => void requestPreview(true)}
            onCancelRequest={requestClose}
            hints={setup.hints}
            metrics={{
              form: metricsForm,
              onChange: (updater) => {
                metricsTouched.current = true;
                setMetricsForm(updater);
              },
              sources: setup.metrics.sources,
              previous: setup.previousMetrics,
              errors: metricsAttempted ? metricsErrors : {},
            }}
            onOpenIntegrations={onOpenIntegrations}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

type PreviewState = { kind: "manual"; preview: ManualPlanPreview } | { kind: "rebuild"; data: RebuildPreview };

type MetricsBinding = {
  form: MetricsForm;
  onChange: (updater: (current: MetricsForm) => MetricsForm) => void;
  sources: MetricsSources;
  previous: MetricsSnapshot | null;
  errors: MetricsErrors;
};

function PlanCreationStepLayer({
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
    stepKey === "metrics" ? copy.plans.metrics.question : creationCopy.steps[stepKey]?.question;
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

        {stepKey === "goalSetup" && hints && (hints.previousTargetDate || previousResult) ? (
          <SheetBlock theme={theme}>
            <Notice
              theme={theme}
              action={
                previousResult
                  ? {
                      label: fillTemplate(rebuildCopy.improveGoal, { percent: IMPROVE_PERCENT }),
                      // Display helper only: fills the target field, the plan is computed by the server.
                      onPress: () =>
                        onDraftChange((current) => ({
                          ...current,
                          goal: {
                            ...current.goal,
                            target: {
                              ...(current.goal.target ?? {}),
                              finishTimeSec: Math.round((previousResult * (100 - IMPROVE_PERCENT)) / 100),
                            },
                          },
                        })),
                    }
                  : undefined
              }
            >
              {[
                hints.previousTargetDate
                  ? fillTemplate(rebuildCopy.previousTargetDate, { date: formatShortDate(hints.previousTargetDate, language) })
                  : null,
                previousResult ? fillTemplate(rebuildCopy.previousResult, { time: formatTargetTime(previousResult) }) : null,
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
            onChange={(updater) => onDraftChange((current) => ({ ...current, schedule: updater(current.schedule) }))}
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
            <AlertCircle color="#dc2626" size={14} />
            <Text
              style={[
                styles.inlineErrorText,
                { fontFamily: theme.typography.fontFamily.sans.regular },
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
                    backgroundColor:
                      theme.color.controlSecondary,
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
  loadingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  loadingCard: {
    alignSelf: "stretch",
    gap: 16,
    borderRadius: 32,
    padding: 20,
  },
  loadingActions: {
    flexDirection: "row",
    gap: 12,
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
