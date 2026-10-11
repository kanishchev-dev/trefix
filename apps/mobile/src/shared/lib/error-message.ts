import { resolveApiErrorMessage } from "@workspace/utils";

export type ErrorCopy = {
  network: string;
  serverUnavailable: string;
  tooManyRequests: string;
};

/**
 * What to show for a failed request. Backend messages already arrive in the
 * app language (Accept-Language), so they are shown as is; network, rate
 * limit and server failures get the app's own wording, anything else the
 * given fallback.
 */
export function getErrorMessage(
  error: unknown,
  copy: ErrorCopy,
  fallback: string,
): string {
  return resolveApiErrorMessage(error, {
    byStatus: (status) => {
      if (status === 429) return copy.tooManyRequests;
      if (status >= 500) return copy.serverUnavailable;
      return undefined;
    },
    network: copy.network,
    fallback,
  });
}
