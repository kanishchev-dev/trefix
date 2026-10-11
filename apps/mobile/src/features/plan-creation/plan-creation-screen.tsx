import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, View } from "react-native";

import { type AthleteGoalType } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../locales";
import { trackEvent } from "../../lib/analytics";
import { BottomSheet } from "../../shared/ui/bottom-sheet";
import {
  INITIAL_PLAN_CREATION_DRAFT,
  pruneStaleGoalFields,
  withRequiredGoalDefaults,
  type PlanCreationDraft,
} from "./plan-creation-types";
import { toggleTrainingDay } from "./components/schedule-step-fields";
import { shortDayNamesFor } from "./components/workout-edit-form";
import {
  PlanPreviewScreen,
  type PreviewOutcome,
  type PreviewSubmission,
} from "./plan-preview-screen";
import { usePlanDetails } from "../plans/hooks/use-plan";
import {
  useCurrentMetrics,
  useRebuildPrefill,
} from "../plans/hooks/use-plan-rebuild";
import { daysBetween, todayIso } from "../plans/lib/plan-dates";
import {
  metricsFormFromCurrent,
  validateMetricsForm,
  type MetricsErrors,
  type MetricsForm,
} from "../plans/lib/plan-draft";
import { hasErrorCode, planErrorMessage } from "../plans/lib/plan-errors";
import { styles } from "./plan-creation-screen.styles";
import {
  PlanCreationStepLayer,
  type PreviewState,
} from "./components/plan-creation-step-layer";
import {
  STEPS,
  buildPrefilledSetup,
  isCreationStepValid,
  type PlanCreationLaunch,
  type FlowSetup,
} from "./plan-creation-flow";
import { usePlanCreationRequests } from "./hooks/use-plan-creation-requests";
import { PrefillLoadingOverlay } from "./components/prefill-loading-overlay";
export { type PlanCreationLaunch } from "./plan-creation-flow";

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
  return (
    <PlanCreationFlow {...props} launch={{ mode: "create" }} setup={setup} />
  );
}

/** Rebuild and draft parameters: every step is prefilled from the stored plan. */
function PrefilledPlanFlow(
  props: Props & { launch: Exclude<PlanCreationLaunch, { mode: "create" }> },
) {
  const { launch, theme, copy, onClose } = props;
  const planId =
    launch.mode === "rebuild" ? launch.sourcePlanId : launch.planId;
  const prefillQuery = useRebuildPrefill(planId);
  const detailsQuery = usePlanDetails(planId);
  const tracked = useRef(false);

  const setup = useMemo<FlowSetup | null>(
    () =>
      prefillQuery.data && detailsQuery.data
        ? buildPrefilledSetup(
            launch,
            prefillQuery.data,
            detailsQuery.data,
            copy,
          )
        : null,
    [copy, detailsQuery.data, launch, prefillQuery.data],
  );

  useEffect(() => {
    if (tracked.current || launch.mode !== "rebuild" || !detailsQuery.data)
      return;
    tracked.current = true;
    const details = detailsQuery.data;
    const reference =
      details.cancelledAt ?? details.endDate ?? details.updatedAt;
    trackEvent("plan_rebuild_started", {
      sourceStatus: details.status,
      sourceAgeDays: Math.max(
        0,
        daysBetween(reference.slice(0, 10), todayIso()),
      ),
    });
  }, [detailsQuery.data, launch.mode]);

  if (!setup) {
    return (
      <PrefillLoadingOverlay
        theme={theme}
        themeMode={props.themeMode}
        copy={copy}
        failed={prefillQuery.isError || detailsQuery.isError}
        onClose={onClose}
        onRetry={() => {
          void prefillQuery.refetch();
          void detailsQuery.refetch();
        }}
      />
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
  const [metricsForm, setMetricsForm] = useState<MetricsForm>(
    setup.metrics.form,
  );
  const [metricsSkipped, setMetricsSkipped] = useState(false);
  const [metricsAttempted, setMetricsAttempted] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pendingPreview, setPendingPreview] = useState<PreviewState | null>(
    null,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const createdPlanId = useRef<string | null>(null);
  const savedName = useRef<string>("");
  const metricsTouched = useRef(false);

  // The current form estimate may arrive after the flow opened; keep the user's input.
  useEffect(() => {
    if (!metricsTouched.current) setMetricsForm(setup.metrics.form);
  }, [setup.metrics.form]);

  const step = STEPS[stepIndex];
  const shortDayNames = useMemo(() => shortDayNamesFor(language), [language]);
  const requireVolume = !isCreate;

  const metricsErrors = useMemo<MetricsErrors>(
    () => validateMetricsForm(metricsForm, { requireVolume }),
    [metricsForm, requireVolume],
  );

  const isStepValid = useMemo(
    () => isCreationStepValid(step, draft),
    [step, draft],
  );

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
          ? withRequiredGoalDefaults(
              pruneStaleGoalFields(current.goal, newType),
            )
          : withRequiredGoalDefaults({ type: newType }),
    }));
    setStepIndex(1);
  }, []);

  const requests = usePlanCreationRequests({
    launch,
    setup,
    draft,
    metricsForm,
    metricsSkipped,
  });

  const requestPreview = useCallback(
    async (skipMetrics: boolean) => {
      setPreviewError(null);
      try {
        setPendingPreview(await requests.preview(skipMetrics));
        setMetricsSkipped(skipMetrics);
        setSheetVisible(false);
      } catch (error) {
        setPreviewError(
          hasErrorCode(error, "PLAN_METRICS_INVALID")
            ? copy.plans.metrics.invalid
            : planErrorMessage(
                error,
                copy,
                creationCopy.errors.generationFailed,
              ),
        );
      }
    },
    [copy, creationCopy.errors.generationFailed, requests],
  );

  const handleSubmit = useCallback(
    async (submission: PreviewSubmission) => {
      savedName.current = submission.name ?? setup.defaultName ?? "";
      createdPlanId.current = await requests.submit(submission);
    },
    [requests, setup.defaultName],
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
          sessionsPerWeek: Math.min(
            current.structure.sessionsPerWeek,
            Math.max(schedule.trainingDays.length, 1),
          ),
        },
      };
    });
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (preview) {
          setPreview(null);
          setSheetVisible(true);
          setStepIndex(0);
          return true;
        }

        return false;
      },
    );

    return () => subscription.remove();
  }, [preview]);

  const handleCompleted = useCallback(
    (outcome: PreviewOutcome) => {
      if (outcome === "started") {
        onCompleted?.({ kind: "started", name: savedName.current });
      } else if (outcome === "draft") {
        onCompleted?.({
          kind: "draft",
          planId: createdPlanId.current,
          name: savedName.current,
        });
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
        preview={
          isDraftParams
            ? { ...preview.data.preview, startDate: "" }
            : preview.data.preview
        }
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
  const previewPending = requests.previewPending;

  return (
    <View style={styles.root} pointerEvents="none">
      <BottomSheet
        mode="stack"
        visible={sheetVisible}
        onClose={handleFlowClosed}
        onStackPop={() => setStepIndex((current) => Math.max(current - 1, 0))}
        onDismissRequest={requestClose}
        layerTitles={visibleLayers.map((stepKey) =>
          stepKey === "metrics"
            ? copy.plans.metrics.title
            : (creationCopy.steps[stepKey]?.title ?? stepKey),
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
