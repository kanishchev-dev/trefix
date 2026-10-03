import type { ApiClientError } from "@workspace/api-client";

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Resolves a human readable message for an API error.
 *
 * Backend error codes and HTTP statuses are mapped to translation keys so the
 * message follows the active locale instead of being hardcoded. Resolution
 * order: error code -> HTTP status -> backend message -> fallback, always
 * falling back to the English dictionary when a key is missing.
 */
export function getFriendlyApiMessage(
  error: unknown,
  t: TranslateFn,
): string {
  if (isApiClientError(error)) {
    if (error.code) {
      const codeKey = `errors.apiCodes.${error.code}`;
      const byCode = t(codeKey);
      if (byCode !== codeKey) {
        return byCode;
      }
    }

    const statusKey = `errors.byStatus.${error.status}`;
    const byStatus = t(statusKey);
    if (byStatus !== statusKey) {
      return byStatus;
    }

    return error.message || t("errors.fallback");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return t("errors.fallback");
}

/**
 * Auth flows share the same error surface as the rest of the API.
 */
export function getFriendlyAuthMessage(
  error: unknown,
  t: TranslateFn,
): string {
  return getFriendlyApiMessage(error, t);
}

function isApiClientError(error: unknown): error is ApiClientError {
  return Boolean(error && typeof error === "object" && "status" in error);
}