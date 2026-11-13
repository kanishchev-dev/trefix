import {
  ApiClientError,
  activePlanSummarySchema,
  type ActivePlanSummary,
} from "@trefix/api-client";

/** Summary of the user's plan in progress attached to `409 ACTIVE_PLAN_EXISTS`. */
export function activePlanFromError(error: unknown): ActivePlanSummary | null {
  if (
    !(error instanceof ApiClientError) ||
    error.code !== "ACTIVE_PLAN_EXISTS"
  ) {
    return null;
  }
  const body = error.details as
    | { details?: { activePlan?: unknown } }
    | null
    | undefined;
  const parsed = activePlanSummarySchema.safeParse(body?.details?.activePlan);
  return parsed.success ? parsed.data : null;
}

/** A version conflict means someone (the athlete, the coach) changed the plan meanwhile: reload before retrying. */
export function isVersionConflict(error: unknown): boolean {
  return (
    error instanceof ApiClientError && error.code === "PLAN_VERSION_CONFLICT"
  );
}
