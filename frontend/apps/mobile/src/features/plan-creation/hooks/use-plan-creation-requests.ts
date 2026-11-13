import { useCallback, useMemo } from "react";

import { trackEvent } from "../../../lib/analytics";
import {
  useRebuildPlan,
  useRebuildPreview,
} from "../../plans/hooks/use-plan-rebuild";
import { getDeviceTimezone } from "../../plans/lib/plan-dates";
import {
  goalPayload,
  metricsPayload,
  type MetricsForm,
} from "../../plans/lib/plan-draft";
import { saveFieldsFor } from "../../plans/lib/start-plan";
import { type PreviewState } from "../components/plan-creation-step-layer";
import { type FlowSetup, type PlanCreationLaunch } from "../plan-creation-flow";
import { type PlanCreationDraft } from "../plan-creation-types";
import { type PreviewSubmission } from "../plan-preview-screen";
import { toDraftWeekOverrides, toManualWeekOverrides } from "../preview-edits";
import { useCreateManualPlan, useManualPlanPreview } from "./use-manual-plan";

type Options = {
  launch: PlanCreationLaunch;
  setup: FlowSetup;
  draft: PlanCreationDraft;
  metricsForm: MetricsForm;
  metricsSkipped: boolean;
};

/**
 * Server calls of the creation flow: the preview of the plan being set up and
 * saving it. Plain creation goes to the manual plan endpoints; rebuild and
 * draft parameters go to the rebuild endpoints of the source plan.
 */
export function usePlanCreationRequests({
  launch,
  setup,
  draft,
  metricsForm,
  metricsSkipped,
}: Options) {
  const manualPreview = useManualPlanPreview();
  const rebuildPreview = useRebuildPreview();
  const createPlan = useCreateManualPlan();
  const rebuildPlan = useRebuildPlan();

  const sourcePlanId =
    launch.mode === "create"
      ? null
      : launch.mode === "rebuild"
        ? launch.sourcePlanId
        : launch.planId;
  const target = launch.mode === "rebuild" ? "new_draft" : "in_place";

  /** Preview with or without the metrics step; rejects with the API error. */
  const preview = useCallback(
    async (skipMetrics: boolean): Promise<PreviewState> => {
      const metrics = skipMetrics ? undefined : metricsPayload(metricsForm);
      const timezone = getDeviceTimezone();
      if (sourcePlanId === null) {
        const result = await manualPreview.mutateAsync({
          goal: goalPayload(draft),
          schedule: draft.schedule,
          structure: draft.structure,
          metrics,
          timezone,
        });
        return { kind: "manual", preview: result };
      }

      const result = await rebuildPreview.mutateAsync({
        planId: sourcePlanId,
        goal: goalPayload(draft),
        schedule: draft.schedule,
        structure: draft.structure,
        metrics: metrics ?? {},
        target,
        timezone,
      });
      const volumeScale = result.diff.summary.adjustments.find(
        (item) => item.code === "VOLUME_SCALED",
      )?.params?.k;
      trackEvent("plan_rebuild_previewed", {
        mode: result.mode,
        volumeScale: typeof volumeScale === "number" ? volumeScale : null,
      });
      return { kind: "rebuild", data: result };
    },
    [draft, manualPreview, metricsForm, rebuildPreview, sourcePlanId, target],
  );

  /** Saves (and possibly starts) the plan; resolves to the id of the stored plan. */
  const submit = useCallback(
    async ({
      edits,
      name,
      notes,
      decision,
    }: PreviewSubmission): Promise<string | null> => {
      const metrics = metricsSkipped ? undefined : metricsPayload(metricsForm);

      if (sourcePlanId === null) {
        if (!decision) return null;
        const plan = await createPlan.mutateAsync({
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
        if (decision.kind === "draft") {
          trackEvent("plan_saved_as_draft", { source: "manual" });
        }
        return plan.id;
      }

      const result = await rebuildPlan.mutateAsync({
        planId: sourcePlanId,
        goal: goalPayload(draft),
        schedule: draft.schedule,
        structure: draft.structure,
        metrics: metrics ?? {},
        target,
        weekOverrides: toDraftWeekOverrides(edits),
        expectedVersion:
          launch.mode === "draft-params" ? setup.source?.version : undefined,
        ...(decision ? saveFieldsFor(decision, { name, notes }) : {}),
      });
      if (launch.mode === "rebuild") {
        trackEvent("plan_rebuild_saved", {
          saveAsDraft: decision?.kind === "draft",
          started: decision?.kind === "start",
        });
        if (decision?.kind === "draft") {
          trackEvent("plan_saved_as_draft", { source: "rebuild" });
        }
      }
      return result.id;
    },
    [
      createPlan,
      draft,
      launch.mode,
      metricsForm,
      metricsSkipped,
      rebuildPlan,
      setup.source?.version,
      sourcePlanId,
      target,
    ],
  );

  const previewPending = manualPreview.isPending || rebuildPreview.isPending;

  return useMemo(
    () => ({ preview, submit, previewPending }),
    [preview, submit, previewPending],
  );
}
