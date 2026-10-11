/** Minimal shape of an API error, satisfied by `ApiClientError`. */
export type ApiErrorLike = { status: number; code?: string; message?: string };

export type ErrorMessageLookup = {
  /** Message for a backend error code, if the app has its own wording. */
  byCode?: (code: string) => string | undefined;
  /** Message for an HTTP status (401, 403, 404, 409, 429, 5xx…). */
  byStatus?: (status: number) => string | undefined;
  /** Shown when the request never reached the server. */
  network?: string;
  fallback: string;
};

export function isApiErrorLike(error: unknown): error is ApiErrorLike {
  return Boolean(
    error &&
      typeof error === "object" &&
      typeof (error as { status?: unknown }).status === "number",
  );
}

/**
 * User-facing message for a failed request: app wording by error code, then
 * by HTTP status, then the backend message (it is already in the request
 * language), then the fallback. Network failures get their own message
 * instead of the platform's technical text.
 */
export function resolveApiErrorMessage(
  error: unknown,
  lookup: ErrorMessageLookup,
): string {
  if (isApiErrorLike(error)) {
    const byCode = error.code ? lookup.byCode?.(error.code) : undefined;
    if (byCode) {
      return byCode;
    }
    const byStatus = lookup.byStatus?.(error.status);
    if (byStatus) {
      return byStatus;
    }
    return error.message || lookup.fallback;
  }
  if (error instanceof TypeError && lookup.network) {
    // fetch rejects with TypeError when the request cannot be sent at all.
    return lookup.network;
  }
  return lookup.fallback;
}
