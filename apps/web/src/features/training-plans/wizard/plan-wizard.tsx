"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription } from "@trefix/ui/components/alert";
import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { Label } from "@trefix/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@trefix/ui/components/radio-group";
import { Skeleton } from "@trefix/ui/components/skeleton";
import { Spinner } from "@trefix/ui/components/spinner";
import { cn } from "@trefix/ui/lib/utils";
import { CheckIcon } from "lucide-react";

import type {
  CurrentMetrics,
  ManualPlanPreview,
  PlanDetails,
  RebuildPreview,
  RebuildTarget,
} from "@trefix/api-client";

import { getBrowserTimezone } from "@/features/training-calendar/lib/calendar-dates";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

import { PlanDiffView } from "../components/plan-diff-view";
import { PlanWeeksView } from "../components/plan-weeks-view";
import { resolveStartOption } from "../components/start-options-field";
import {
  useCreateManualPlan,
  usePreviewManualPlan,
  usePreviewRebuild,
  useRebuildPlan,
} from "../hooks/use-user-plans";
import { activePlanFromError, isVersionConflict } from "../lib/plan-errors";
import { formatNumber, formatPlanDate } from "../lib/plan-format";
import type { PlanWeekView } from "../lib/plan-weeks";
import {
  PLAN_WIZARD_STEP_FIELDS,
  PLAN_WIZARD_STEPS,
  planWizardSchema,
  toCreateInput,
  toPreviewInput,
  toRebuildInput,
  toRebuildPreviewInput,
  validateSaveOptions,
  type PlanWizardStep,
  type PlanWizardValues,
} from "../lib/plan-wizard-form";
import { GoalStep } from "./goal-step";
import { MetricsStep } from "./metrics-step";
import { SaveOptions } from "./save-options";
import { ScheduleStep } from "./schedule-step";

type PreviewResult =
  | { kind: "create"; key: string; preview: ManualPlanPreview }
  | { kind: "rebuild"; key: string; preview: RebuildPreview };

/** Preview weeks shaped like plan weeks, so the same week list renders them. */
function previewWeeks(result: PreviewResult): PlanWeekView[] {
  const weeks = result.kind === "rebuild" ? result.preview.weeks : null;
  if (weeks) {
    return weeks.map((week) => ({
      weekNumber: week.weekNumber,
      phase: week.phase,
      workouts: week.workouts.map((workout) => ({
        ...workout,
        kind: "relative" as const,
      })),
      distanceKm:
        Math.round(
          week.workouts.reduce((sum, workout) => sum + workout.distanceKm, 0) *
            10,
        ) / 10,
    }));
  }

  const manual =
    result.kind === "create" ? result.preview : result.preview.preview;
  return manual.weeks.map((week) => ({
    weekNumber: week.weekNumber,
    phase: week.phase,
    workouts: week.workouts.map((workout) => ({
      ...workout,
      key: workout.id,
      kind: "relative" as const,
    })),
    distanceKm: Math.round(week.plannedDistance * 10) / 10,
  }));
}

/**
 * Plan creation wizard of the admin panel, also used for "prepare again".
 * Goal → schedule → metrics → preview: the preview is computed by the
 * training engine and recomputed whenever the parameters change, and only
 * the previewed parameters can be saved.
 */
export function PlanWizard({
  userId,
  initialValues,
  currentMetrics,
  rebuildSource,
  onSaved,
}: {
  userId: string;
  initialValues: PlanWizardValues;
  currentMetrics: CurrentMetrics | undefined;
  /** Present in "prepare again": the history plan or draft the new plan is built from. */
  rebuildSource?: PlanDetails;
  onSaved: (plan: PlanDetails) => void;
}): ReactElement {
  const { t, locale } = useI18n();
  const timezone = useMemo(() => getBrowserTimezone(), []);
  const [step, setStep] = useState<PlanWizardStep>("goal");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [target, setTarget] = useState<RebuildTarget>(
    rebuildSource?.status === "draft" ? "in_place" : "new_draft",
  );

  const form = useForm<PlanWizardValues>({
    resolver: zodResolver(planWizardSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });

  const previewManual = usePreviewManualPlan(userId);
  const previewRebuild = usePreviewRebuild(userId, rebuildSource?.id ?? "");
  const createPlan = useCreateManualPlan(userId);
  const rebuildPlan = useRebuildPlan(userId, rebuildSource?.id ?? "");

  const values = useWatch({ control: form.control });
  const stepIndex = PLAN_WIZARD_STEPS.indexOf(step);

  // The preview depends on everything but the save options; any other edit invalidates it.
  const previewKey = useMemo(() => {
    const current = values as PlanWizardValues;
    return JSON.stringify({
      goal: [
        current.goalType,
        current.goalTarget,
        current.goalCurrent,
        current.goalDescription,
        current.goalTargetDate,
      ],
      schedule: [
        current.trainingDays,
        current.preferredLongRunDay,
        current.workoutDurationMinutes,
      ],
      structure: [current.totalWeeks, current.sessionsPerWeek, current.focus],
      metrics: current.metrics,
      target,
    });
  }, [values, target]);

  const runPreview = () => {
    const current = form.getValues();
    const onError = (error: unknown) =>
      notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));

    if (rebuildSource) {
      previewRebuild.mutate(toRebuildPreviewInput(current, target, timezone), {
        onSuccess: (preview) =>
          setResult({ kind: "rebuild", key: previewKey, preview }),
        onError,
      });
    } else {
      previewManual.mutate(toPreviewInput(current, timezone), {
        onSuccess: (preview) =>
          setResult({ kind: "create", key: previewKey, preview }),
        onError,
      });
    }
  };

  useEffect(() => {
    if (step === "preview" && result?.key !== previewKey) {
      runPreview();
    }
    // runPreview reads the latest form values itself; the key is what decides a rerun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, previewKey]);

  const goTo = async (next: PlanWizardStep) => {
    const nextIndex = PLAN_WIZARD_STEPS.indexOf(next);
    if (nextIndex > stepIndex) {
      // Every step up to the target must be valid, not only the current one.
      for (const pending of PLAN_WIZARD_STEPS.slice(0, nextIndex)) {
        if (pending === "preview") continue;
        const valid = await form.trigger(PLAN_WIZARD_STEP_FIELDS[pending]);
        if (!valid) {
          setStep(pending);
          return;
        }
      }
    }
    setStep(next);
  };

  const currentResult = result?.key === previewKey ? result : null;
  const startOptions =
    currentResult?.kind === "create"
      ? currentResult.preview.startOptions
      : currentResult?.preview.startOptions;
  const isPreviewing = previewManual.isPending || previewRebuild.isPending;
  const isSaving = createPlan.isPending || rebuildPlan.isPending;

  const save = form.handleSubmit((submitted) => {
    const startOption = resolveStartOption(startOptions, submitted.startKind);
    const error = validateSaveOptions(
      submitted,
      startOption,
      Boolean(startOptions?.activePlan),
    );
    setSaveError(error);
    if (error) return;

    const handlers = {
      onSuccess: (plan: PlanDetails) => {
        notifySuccess(
          t(
            submitted.saveMode === "start"
              ? "userPlans.toasts.createdStarted"
              : "userPlans.toasts.created",
          ),
        );
        onSaved(plan);
      },
      onError: (failure: unknown) => {
        if (activePlanFromError(failure)) {
          setSaveError("userPlans.wizard.errors.replaceActive");
        }
        notifyError(
          t("common.states.error"),
          isVersionConflict(failure)
            ? t("userPlans.errors.versionConflict")
            : getFriendlyApiMessage(failure, t),
        );
      },
    };

    if (rebuildSource) {
      rebuildPlan.mutate(
        toRebuildInput(
          submitted,
          target,
          startOption,
          timezone,
          target === "in_place" ? rebuildSource.version : undefined,
        ),
        handlers,
      );
    } else {
      createPlan.mutate(
        toCreateInput(submitted, startOption, timezone),
        handlers,
      );
    }
  });

  const summary = currentResult
    ? currentResult.kind === "create"
      ? currentResult.preview
      : currentResult.preview.preview
    : null;

  return (
    <div className="flex flex-col gap-4">
      <ol
        className="flex flex-wrap items-center gap-2"
        aria-label={t("userPlans.wizard.stepsLabel")}
      >
        {PLAN_WIZARD_STEPS.map((item, index) => {
          const done = index < stepIndex;
          const active = item === step;
          return (
            <li key={item}>
              <Button
                type="button"
                variant={active ? "secondary" : "ghost"}
                size="sm"
                aria-current={active ? "step" : undefined}
                onClick={() => void goTo(item)}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-xs tabular-nums",
                    (done || active) &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : index + 1}
                </span>
                {t(`userPlans.wizard.steps.${item}`)}
              </Button>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>{t(`userPlans.wizard.steps.${step}`)}</CardTitle>
          <CardDescription>
            {t(`userPlans.wizard.stepHints.${step}`)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "goal" ? <GoalStep form={form} /> : null}
          {step === "schedule" ? <ScheduleStep form={form} /> : null}
          {step === "metrics" ? (
            <MetricsStep form={form} currentMetrics={currentMetrics} />
          ) : null}
          {step === "preview" ? (
            <div className="flex flex-col gap-6">
              {rebuildSource?.status === "draft" ? (
                <RadioGroup
                  value={target}
                  onValueChange={(value) =>
                    setTarget(value === "new_draft" ? "new_draft" : "in_place")
                  }
                >
                  {(["in_place", "new_draft"] as const).map((option) => (
                    <div key={option} className="flex items-center gap-2">
                      <RadioGroupItem
                        id={`rebuild-target-${option}`}
                        value={option}
                      />
                      <Label
                        htmlFor={`rebuild-target-${option}`}
                        className="font-normal"
                      >
                        {t(`userPlans.rebuild.targets.${option}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : null}

              {isPreviewing || !currentResult || !summary ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("userPlans.wizard.previewSummary", {
                      weeks: summary.totalWeeks,
                      sessions: summary.trainingFrequency,
                      volume: formatNumber(summary.weeklyTargetKm, locale),
                      start: formatPlanDate(summary.startDate, locale),
                      end: formatPlanDate(summary.endDate, locale),
                    })}
                  </p>

                  {currentResult.kind === "rebuild" ? (
                    <div className="flex flex-col gap-2 rounded-xl border p-4">
                      <span className="text-sm font-medium">
                        {currentResult.preview.mode === "regenerated"
                          ? t("userPlans.rebuild.regenerated")
                          : t("userPlans.rebuild.diffTitle")}
                      </span>
                      <PlanDiffView
                        diff={currentResult.preview.diff}
                        warnings={currentResult.preview.warnings}
                      />
                    </div>
                  ) : null}

                  <div className="-mx-3">
                    <PlanWeeksView
                      weeks={previewWeeks(currentResult)}
                      defaultOpenWeek={1}
                      canEdit={() => false}
                      onEdit={() => undefined}
                    />
                  </div>

                  <Alert>
                    <AlertDescription>
                      {t("userPlans.wizard.editAfterSave")}
                    </AlertDescription>
                  </Alert>

                  <SaveOptions
                    form={form}
                    startOptions={startOptions}
                    saveError={saveError}
                  />
                </>
              )}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={stepIndex === 0 || isSaving}
            onClick={() => setStep(PLAN_WIZARD_STEPS[stepIndex - 1])}
          >
            {t("common.actions.back")}
          </Button>
          {step === "preview" ? (
            <Button
              type="button"
              disabled={!currentResult || isPreviewing || isSaving}
              onClick={() => void save()}
            >
              {isSaving ? <Spinner /> : null}
              {rebuildSource
                ? t("userPlans.rebuild.save")
                : t("userPlans.wizard.save")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void goTo(PLAN_WIZARD_STEPS[stepIndex + 1])}
            >
              {t("common.actions.continue")}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
