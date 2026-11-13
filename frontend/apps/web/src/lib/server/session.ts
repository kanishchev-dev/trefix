import { type NextRequest, NextResponse } from "next/server";

import {
  BackendUnavailableError,
  backendUnavailableResponse,
  fetchBackend,
  isSessionRejection,
} from "./backend-availability";
import { payloadToFetchInit, type ProxyPayload } from "./proxy-payload";
import {
  runSingleFlightRefresh,
  type RefreshedAuthTokens,
} from "./refresh-single-flight";

/**
 * Server side of the browser session: httpOnly cookies with the backend
 * tokens, the single-flight refresh and forwarding to the backend. Every BFF
 * route and the proxy go through here, so cookie names, lifetimes and the
 * refresh rules exist once.
 */

export const BACKEND_BASE_URL =
  process.env.AUTH_BACKEND_URL ?? "http://127.0.0.1:3000/v1";

export const ACCESS_COOKIE = "trefix_access_token";
export const REFRESH_COOKIE = "trefix_refresh_token";
export const SESSION_COOKIE = "trefix_session_id";

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type SessionTokens = RefreshedAuthTokens;

/**
 * Stores the rotated tokens. The backend spends the refresh token on every
 * exchange, so dropping the new one would make the next refresh look like a
 * replay and the backend would delete the session.
 */
export function setAuthCookies<T extends NextResponse>(
  response: T,
  tokens: SessionTokens,
): T {
  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...common,
    maxAge: tokens.accessTokenExpiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...common,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
  response.cookies.set(SESSION_COOKIE, tokens.sessionId, {
    ...common,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearAuthCookies<T extends NextResponse>(response: T): T {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

/** 401 for a session that cannot be renewed; the cookies go with it. */
export function sessionExpiredResponse(): NextResponse {
  return clearAuthCookies(
    NextResponse.json(
      {
        statusCode: 401,
        message: "Session expired",
        code: "AUTH_TOKEN_INVALID",
      },
      { status: 401 },
    ),
  );
}

/**
 * Exchanges the refresh cookie for new tokens, once per token across
 * concurrent requests. `null` means the session is over; a backend that does
 * not answer throws `BackendUnavailableError`.
 */
export async function refreshSessionTokens(
  request: NextRequest,
): Promise<SessionTokens | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return null;
  }

  return runSingleFlightRefresh(refreshToken, async () => {
    const response = await fetchBackend(`${BACKEND_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) {
      if (isSessionRejection(response.status)) {
        return null;
      }
      throw new BackendUnavailableError(response.status);
    }
    return (await response.json()) as SessionTokens;
  });
}

/** Forwards the request to `path` (with the original query string) on the backend. */
export async function forwardToBackend(
  request: NextRequest,
  path: string,
  method: HttpMethod,
  payload: ProxyPayload,
  accessToken?: string | null,
): Promise<Response> {
  const { body, headers, duplex } = payloadToFetchInit(payload);
  const language = request.headers.get("accept-language");

  return fetchBackend(`${BACKEND_BASE_URL}${path}${request.nextUrl.search}`, {
    method,
    headers: {
      ...headers,
      ...(language ? { "accept-language": language } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
    ...(duplex ? { duplex } : {}),
    cache: "no-store",
  } as RequestInit);
}

/**
 * A 401 about what the user typed (a wrong current password), not about the
 * token: refreshing would spend the refresh token for nothing.
 */
async function isCredentialRejection(response: Response): Promise<boolean> {
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { code?: string } | null;
  return body?.code === "AUTH_INVALID_CREDENTIALS";
}

/** Copies a backend answer into a Next response (JSON, text or empty). */
export async function responseFromBackend(
  response: Response,
): Promise<NextResponse> {
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await response.json().catch(() => null);
    return NextResponse.json(json, { status: response.status });
  }

  // Files (CSV exports, data archives) and plain text are streamed through as they are.
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["content-type"] = contentType;
  }
  const disposition = response.headers.get("content-disposition");
  if (disposition) {
    headers["content-disposition"] = disposition;
  }
  return new NextResponse(response.body, { status: response.status, headers });
}

/**
 * Forwards with the session's access token; on 401 refreshes once, repeats
 * the call and stores the rotated cookies.
 */
export async function forwardWithSession(
  request: NextRequest,
  path: string,
  method: HttpMethod,
  payload: ProxyPayload,
): Promise<NextResponse> {
  const result = await callWithSession(request, path, method, payload);
  if (!result) {
    return sessionExpiredResponse();
  }
  const response = await responseFromBackend(result.response);
  return result.refreshed
    ? setAuthCookies(response, result.refreshed)
    : response;
}

/**
 * The raw backend answer of an authenticated call, refreshing once on 401.
 * `null` when the session cannot be renewed; `refreshed` holds the rotated
 * tokens the caller has to store.
 */
export async function callWithSession(
  request: NextRequest,
  path: string,
  method: HttpMethod,
  payload: ProxyPayload,
): Promise<{ response: Response; refreshed: SessionTokens | null } | null> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const response = await forwardToBackend(
    request,
    path,
    method,
    payload,
    accessToken,
  );
  if (response.status !== 401 || (await isCredentialRejection(response))) {
    return { response, refreshed: null };
  }

  const tokens = await refreshSessionTokens(request);
  if (!tokens) {
    return null;
  }
  const retried = await forwardToBackend(
    request,
    path,
    method,
    payload,
    tokens.accessToken,
  );
  return { response: retried, refreshed: tokens };
}

/**
 * Answer for a backend call that issued a session (login, invite, password
 * change): the tokens go into httpOnly cookies and are removed from the body,
 * so page scripts never see the refresh token.
 */
export async function sessionIssuedResponse(
  response: Response,
): Promise<NextResponse> {
  if (!response.ok) {
    return responseFromBackend(response);
  }
  const tokens = (await response.json()) as SessionTokens &
    Record<string, unknown>;
  return setAuthCookies(
    NextResponse.json(withoutTokens(tokens), { status: 200 }),
    tokens,
  );
}

/** The session as the browser may see it: everything except the tokens themselves. */
export function withoutTokens<T extends Record<string, unknown>>(
  body: T,
): Omit<T, "accessToken" | "refreshToken"> {
  const rest: Record<string, unknown> = { ...body };
  delete rest.accessToken;
  delete rest.refreshToken;
  return rest as Omit<T, "accessToken" | "refreshToken">;
}

/** A backend that does not answer is a 503 with the cookies left alone, never a "session expired". */
export async function withBackendAvailability(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return backendUnavailableResponse();
    }
    throw error;
  }
}
