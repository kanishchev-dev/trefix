import { ApiClientError, type ApiErrorShape } from "@trefix/api-client";

import { loadAuthSession } from "./auth-session";
import { BACKEND_BASE_URL } from "./backend-url";
import { logger } from "./logger";

const REQUEST_TIMEOUT_MS = 15_000;

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  useAuth?: boolean;
  skipAutoRefresh?: boolean;
};

export type AuthorizedFetchOptions = {
  /** Attach the access token and refresh it once on 401. */
  useAuth?: boolean;
  skipAutoRefresh?: boolean;
  timeoutMs?: number;
};

let requestLanguage: string | null = null;

/** Language the backend should answer in (error messages, coach texts). */
export function setRequestLanguage(language: string | null): void {
  requestLanguage = language;
}

/** Headers every backend call carries: the access token and the app language. */
export async function backendHeaders(
  useAuth: boolean,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (requestLanguage) {
    headers["Accept-Language"] = requestLanguage;
  }
  if (useAuth) {
    const session = await loadAuthSession();
    if (session?.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }
  return headers;
}

/**
 * The only place that talks to the backend over fetch: adds the token and the
 * language, applies a timeout and, on 401, refreshes the session once and
 * repeats the call. A refresh that fails for network reasons is rethrown as
 * is, so being offline never looks like a rejected session.
 */
export async function authorizedFetch(
  path: string,
  init: RequestInit,
  options: AuthorizedFetchOptions = {},
): Promise<Response> {
  const send = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? REQUEST_TIMEOUT_MS,
    );
    try {
      return await fetch(`${BACKEND_BASE_URL}${path}`, {
        ...init,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          ...(await backendHeaders(Boolean(options.useAuth))),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const response = await send();
  if (response.status !== 401 || !options.useAuth || options.skipAutoRefresh) {
    return response;
  }

  const { refreshAuthTokens } = await import("./auth-api");
  const refreshed = await refreshAuthTokens();
  return refreshed ? send() : response;
}

/** Normalized error for a non-2xx response. */
export async function toApiError(response: Response): Promise<ApiClientError> {
  const errorBody = (await response
    .json()
    .catch(() => null)) as ApiErrorShape | null;
  return new ApiClientError(
    errorBody?.message ?? `Request failed with status ${response.status}`,
    response.status,
    errorBody?.code,
    errorBody,
  );
}

/** JSON request to the backend. */
export async function request<TResponse>(
  path: string,
  options?: RequestOptions,
): Promise<TResponse> {
  const method = options?.method ?? "GET";
  logger.debug(`[API] ${method} ${path}`);

  const response = await authorizedFetch(
    path,
    {
      method,
      headers: { "content-type": "application/json" },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    },
    { useAuth: options?.useAuth, skipAutoRefresh: options?.skipAutoRefresh },
  );

  if (!response.ok) {
    const error = await toApiError(response);
    logger.debug(
      `[API] ${method} ${path} -> ${response.status} ${error.code ?? ""}`,
    );
    throw error;
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  // Some mutating endpoints answer 200/201 with an empty body.
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as TResponse;
}
