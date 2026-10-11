import {
  ApiClientError,
  activePlanSummarySchema,
  type ActivePlanSummary,
} from "@workspace/api-client";

import { fillTemplate, type MainCopy } from "../../../locales";

export const PLANS_LIMIT_MAX = 100;

/** Error codes the plans flows react to. */
export type PlanErrorCode =
  | "ACTIVE_PLAN_EXISTS"
  | "PLAN_VERSION_CONFLICT"
  | "WORKOUT_LOCKED"
  | "WORKOUT_CANCELLED"
  | "PLAN_INVALID_STATUS"
  | "PLAN_ACTIVE_CANNOT_DELETE"
  | "PLAN_CHANGE_INVALID"
  | "PLAN_RESIZE_NOT_POSSIBLE"
  | "PLAN_METRICS_INVALID"
  | "PLAN_START_DATE_INVALID"
  | "PLANS_LIMIT_REACHED"
  | "TRAINING_PLAN_NOT_FOUND";

export function getErrorCode(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.code : undefined;
}

export function hasErrorCode(error: unknown, code: PlanErrorCode): boolean {
  return getErrorCode(error) === code;
}

export function isNotFound(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 404 || error.code === "TRAINING_PLAN_NOT_FOUND")
  );
}

/** Network failures never reach the server and carry no HTTP status. */
export function isNetworkError(error: unknown): boolean {
  return !(error instanceof ApiClientError);
}

/** `details` of the error body: `{ code, message, details }`. */
function errorDetails(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof ApiClientError)) return null;
  const body = error.details as { details?: unknown } | null | undefined;
  const details = body?.details;
  return details && typeof details === "object"
    ? (details as Record<string, unknown>)
    : null;
}

/** Summary of the plan in progress attached to `409 ACTIVE_PLAN_EXISTS`. */
export function activePlanFromError(error: unknown): ActivePlanSummary | null {
  const parsed = activePlanSummarySchema.safeParse(
    errorDetails(error)?.activePlan,
  );
  return parsed.success ? parsed.data : null;
}

/** User-facing message for an error of any plans flow; never the raw server text. */
export function planErrorMessage(
  error: unknown,
  copy: MainCopy,
  fallback?: string,
): string {
  const plansCopy = copy.plans;
  if (isNetworkError(error)) return plansCopy.errors.network;
  switch (getErrorCode(error)) {
    case "PLANS_LIMIT_REACHED":
      return fillTemplate(plansCopy.errors.limit, { max: PLANS_LIMIT_MAX });
    case "TRAINING_PLAN_NOT_FOUND":
      return plansCopy.errors.notFound;
    case "PLAN_INVALID_STATUS":
    case "PLAN_ACTIVE_CANNOT_DELETE":
      return plansCopy.errors.invalidStatus;
    case "PLAN_VERSION_CONFLICT":
      return plansCopy.edit.conflict;
    case "WORKOUT_LOCKED":
      return plansCopy.edit.workoutLocked;
    case "WORKOUT_CANCELLED":
      return plansCopy.edit.cancelledWorkout;
    case "PLAN_CHANGE_INVALID":
      return plansCopy.edit.invalid;
    case "PLAN_RESIZE_NOT_POSSIBLE":
      return plansCopy.goalDate.tooShort;
    case "PLAN_START_DATE_INVALID":
      return plansCopy.start.dateInvalid;
    case "PLAN_METRICS_INVALID":
      return plansCopy.metrics.invalid;
    default:
      return fallback ?? plansCopy.errors.generic;
  }
}
