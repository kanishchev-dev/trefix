import { isApiErrorLike, resolveApiErrorMessage } from "@workspace/utils";

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** Translation for `key`, or `undefined` when the dictionary has none. */
function lookup(t: TranslateFn, key: string): string | undefined {
  const value = t(key);
  return value === key ? undefined : value;
}

/**
 * Human readable message for an API error in the active locale: by error
 * code, then HTTP status, then the backend message, then the fallback.
 * Errors thrown by the app itself keep their own message.
 */
export function getFriendlyApiMessage(error: unknown, t: TranslateFn): string {
  if (!isApiErrorLike(error)) {
    return error instanceof Error ? error.message : t("errors.fallback");
  }
  return resolveApiErrorMessage(error, {
    byCode: (code) => lookup(t, `errors.apiCodes.${code}`),
    byStatus: (status) => lookup(t, `errors.byStatus.${status}`),
    fallback: t("errors.fallback"),
  });
}

/** Auth flows share the same error surface as the rest of the API. */
export function getFriendlyAuthMessage(error: unknown, t: TranslateFn): string {
  return getFriendlyApiMessage(error, t);
}
