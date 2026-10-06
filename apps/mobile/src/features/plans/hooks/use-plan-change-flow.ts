import { useCallback, useRef, useState } from "react";
import { type PlanChangePreview, type PlanChangeRequest } from "@workspace/api-client";

import { trackEvent } from "../../../lib/analytics";
import { type MainCopy } from "../../../locales";
import { isRequestedChangeOnly } from "../lib/plan-diff";
import { hasErrorCode, planErrorMessage } from "../lib/plan-errors";
import { usePlanChanges, type PlanChangeDraft } from "./use-plan-changes";

/** What the user asked for; lets a side-effect-free change skip the diff step. */
export type RequestedChange = { workoutIds: string[]; addedCount: number };

type Stage = "idle" | "previewing" | "confirm" | "applying";

type Options = {
  copy: MainCopy;
  onApplied: () => void;
  /** Error codes that should surface inline under the form instead of the generic message. */
  inlineErrorFor?: (error: unknown) => string | null;
};

/**
 * Preview → (diff) → apply for the plan in progress. A change that touches
 * exactly what was requested and triggers no rule is applied at once;
 * anything else is shown to the user first.
 */
export function usePlanChangeFlow(planId: string | null | undefined, { copy, onApplied, inlineErrorFor }: Options) {
  const { preview: previewMutation, apply: applyMutation } = usePlanChanges(planId);
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const lastDraft = useRef<{ draft: PlanChangeDraft; requested: RequestedChange | null } | null>(null);
  const request = useRef<PlanChangeRequest | null>(null);

  const fail = useCallback(
    (failure: unknown) => {
      if (hasErrorCode(failure, "PLAN_VERSION_CONFLICT")) {
        setConflict(true);
        trackEvent("plan_change_conflict", { kind: lastDraft.current?.draft.kind ?? "unknown" });
        return;
      }
      setError(inlineErrorFor?.(failure) ?? planErrorMessage(failure, copy));
    },
    [copy, inlineErrorFor],
  );

  const applyRequest = useCallback(
    async (next: PlanChangeRequest, hadDiffSheet: boolean) => {
      setStage("applying");
      setError(null);
      try {
        await applyMutation.mutateAsync(next);
        trackEvent("plan_change_applied", {
          kind: next.kind,
          operationsCount: next.kind === "workouts" ? next.operations.length : 0,
          hadDiffSheet,
        });
        setStage("idle");
        setPreview(null);
        onApplied();
      } catch (failure) {
        setStage(hadDiffSheet ? "confirm" : "idle");
        fail(failure);
      }
    },
    [applyMutation, fail, onApplied],
  );

  const submit = useCallback(
    async (draft: PlanChangeDraft, requested: RequestedChange | null, forceFresh = false) => {
      lastDraft.current = { draft, requested };
      setStage("previewing");
      setError(null);
      setConflict(false);
      try {
        const result = await previewMutation.mutateAsync({ draft, forceFresh });
        request.current = result.request;
        if (requested && isRequestedChangeOnly(result.preview, requested)) {
          await applyRequest(result.request, false);
          return;
        }
        setPreview(result.preview);
        setStage("confirm");
      } catch (failure) {
        setStage("idle");
        fail(failure);
      }
    },
    [applyRequest, fail, previewMutation],
  );

  const apply = useCallback(() => {
    if (request.current) void applyRequest(request.current, true);
  }, [applyRequest]);

  /** After a version conflict: reload the plan and preview the same change again. */
  const refresh = useCallback(() => {
    const last = lastDraft.current;
    if (last) void submit(last.draft, last.requested, true);
  }, [submit]);

  const reset = useCallback(() => {
    setStage("idle");
    setPreview(null);
    setError(null);
    setConflict(false);
    request.current = null;
  }, []);

  return {
    stage,
    preview,
    error,
    conflict,
    busy: stage === "previewing" || stage === "applying",
    applying: stage === "applying",
    /** The diff stays on screen while it is being applied. */
    showDiff: preview !== null && (stage === "confirm" || stage === "applying"),
    submit,
    apply,
    refresh,
    reset,
  };
}
