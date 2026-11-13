import {
  validateGoalPayload,
  type MetricsSnapshot,
  type PlanDetails,
  type RebuildPrefill,
} from "@trefix/api-client";

import { fillTemplate, type MainCopy } from "../../locales";
import { todayIso } from "../plans/lib/plan-dates";
import {
  draftFromConfig,
  metricsFormFromCurrent,
  type MetricsForm,
  type MetricsSources,
} from "../plans/lib/plan-draft";
import {
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_SESSIONS,
  MANUAL_PLAN_MIN_WEEKS,
  type PlanCreationDraft,
} from "./plan-creation-types";

/** How the creation flow is opened. */
export type PlanCreationLaunch =
  | { mode: "create" }
  /** "Prepare again" from a completed or cancelled plan. */
  | { mode: "rebuild"; sourcePlanId: string }
  /** New parameters / metrics for a stored draft; optionally straight on the metrics step. */
  | { mode: "draft-params"; planId: string; initialStep?: "metrics" };

export type StepKey =
  | "goalType"
  | "goalSetup"
  | "schedule"
  | "structure"
  | "metrics";

export const STEPS: StepKey[] = [
  "goalType",
  "goalSetup",
  "schedule",
  "structure",
  "metrics",
];

export const IMPROVE_PERCENT = 5;

export type StepMutationState = {
  isPending: boolean;
  error: string | null;
};

export type FlowSetup = {
  initialDraft: PlanCreationDraft;
  metrics: { form: MetricsForm; sources: MetricsSources };
  previousMetrics: MetricsSnapshot | null;
  hints: {
    previousTargetDate: string | null;
    previousResultSeconds: number | null;
  } | null;
  initialStepIndex: number;
  defaultName?: string;
  initialNotes?: string | null;
  source?: PlanDetails;
};

/** Whether the step has what it needs to continue. */
export function isCreationStepValid(
  step: StepKey | undefined,
  draft: PlanCreationDraft,
): boolean {
  if (step === "goalType") {
    return Boolean(draft.goal.type);
  }
  if (step === "goalSetup") {
    if (draft.goal.type === "custom") {
      return Boolean(draft.goal.description?.trim());
    }
    // The draft already holds canonical metric keys; validate it as sent.
    return validateGoalPayload({
      type: draft.goal.type,
      target: draft.goal.target,
      current: draft.goal.current,
      description: draft.goal.description,
    }).valid;
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
}

/** Rebuild and draft parameters: every step is prefilled from the stored plan. */
export function buildPrefilledSetup(
  launch: Exclude<PlanCreationLaunch, { mode: "create" }>,
  prefill: RebuildPrefill,
  details: PlanDetails,
  copy: MainCopy,
): FlowSetup {
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
          previousResultSeconds:
            prefill.goalSuggestion.previousResult?.timeSeconds ?? null,
        }
      : null,
    initialStepIndex:
      launch.mode === "draft-params" && launch.initialStep === "metrics"
        ? STEPS.length - 1
        : 0,
    // A plan without a user-given name keeps none: the apps title it by its goal.
    defaultName: details.name
      ? isRebuild
        ? fillTemplate(copy.plans.rebuild.defaultName, {
            name: details.name,
            year,
          })
        : details.name
      : undefined,
    initialNotes: isRebuild ? null : details.notes,
    source: details,
  };
}
