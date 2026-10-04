import { type NextRequest, NextResponse } from "next/server";

import {
  payloadToFetchInit,
  prepareProxyBody,
  type ProxyPayload,
} from "@/lib/server/proxy-payload";
import { runSingleFlightRefresh } from "@/lib/server/refresh-single-flight";

export const runtime = "nodejs";

const BACKEND_BASE_URL =
  process.env.AUTH_BACKEND_URL ?? "http://127.0.0.1:3000/v1";
const ACCESS_COOKIE = "trefix_access_token";
const REFRESH_COOKIE = "trefix_refresh_token";
const SESSION_COOKIE = "trefix_session_id";

type BackendErrorBody = {
  message?: string;
  code?: string;
  statusCode?: number;
  path?: string;
  timestamp?: string;
  traceId?: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessTokenExpiresIn: number;
};

function buildBackendPath(segments: string[] | undefined): string {
  return `/auth/${(segments ?? []).join("/")}`;
}

async function forwardToBackend(
  request: NextRequest,
  segments: string[] | undefined,
  method: "GET" | "POST",
  payload: ProxyPayload,
  accessToken?: string | null,
) {
  const { body, headers, duplex } = payloadToFetchInit(payload);

  return fetch(`${BACKEND_BASE_URL}${buildBackendPath(segments)}`, {
    method,
    headers: {
      ...headers,
      ...(request.headers.get("accept-language")
        ? { "accept-language": request.headers.get("accept-language") ?? "en" }
        : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
    ...(duplex ? { duplex } : {}),
  } as RequestInit);
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function setAuthCookies(
  response: NextResponse,
  tokens: AuthTokens,
): NextResponse {
  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    path: "/",
  };
  const refreshMaxAge = 60 * 60 * 24 * 30;

  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...common,
    maxAge: tokens.accessTokenExpiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...common,
    maxAge: refreshMaxAge,
  });
  response.cookies.set(SESSION_COOKIE, tokens.sessionId, {
    ...common,
    maxAge: refreshMaxAge,
  });

  return response;
}

function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

async function responseFromBackend(response: Response): Promise<NextResponse> {
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await response.json().catch(() => null);
    return NextResponse.json(json, { status: response.status });
  }

  const text = await response.text().catch(() => "");
  return new NextResponse(text, {
    status: response.status,
    headers: contentType ? { "content-type": contentType } : undefined,
  });
}

async function refreshIfNeeded(
  request: NextRequest,
): Promise<AuthTokens | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return null;
  }

  // Single-flight for the same reason as the admin proxy: this proxy refreshes
  // too (to forward an authenticated request, and to serve /auth/refresh
  // itself), and spending the rotated token twice deletes the session.
  return runSingleFlightRefresh(refreshToken, async () => {
    const response = await forwardToBackend(request, ["refresh"], "POST", {
      kind: "json",
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthTokens;
  });
}

async function resolveAccessToken(
  request: NextRequest,
): Promise<string | null> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    return accessToken;
  }

  const refreshedTokens = await refreshIfNeeded(request);
  return refreshedTokens?.accessToken ?? null;
}

async function handleMe(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  let response = await forwardToBackend(
    request,
    ["me"],
    "GET",
    { kind: "empty" },
    accessToken,
  );

  if (response.status === 401) {
    const refreshedTokens = await refreshIfNeeded(request);
    if (!refreshedTokens) {
      const unauthorized = NextResponse.json(
        {
          statusCode: 401,
          message: "Session expired",
          code: "AUTH_TOKEN_INVALID",
        } satisfies BackendErrorBody,
        { status: 401 },
      );
      return clearAuthCookies(unauthorized);
    }

    response = await forwardToBackend(
      request,
      ["me"],
      "GET",
      { kind: "empty" },
      refreshedTokens.accessToken,
    );
    const nextResponse = await responseFromBackend(response);
    return setAuthCookies(nextResponse, refreshedTokens);
  }

  return responseFromBackend(response);
}

async function handleRefresh(request: NextRequest): Promise<NextResponse> {
  const tokens = await refreshIfNeeded(request);
  if (!tokens) {
    return clearAuthCookies(
      NextResponse.json(
        {
          statusCode: 401,
          message: "Session expired",
          code: "AUTH_TOKEN_INVALID",
        } satisfies BackendErrorBody,
        { status: 401 },
      ),
    );
  }

  return setAuthCookies(NextResponse.json(tokens, { status: 200 }), tokens);
}

async function handleLogin(request: NextRequest): Promise<NextResponse> {
  const response = await forwardToBackend(
    request,
    ["login"],
    "POST",
    await prepareProxyBody(request, "POST"),
  );
  if (!response.ok) {
    return responseFromBackend(response);
  }

  const tokens = (await response.json()) as AuthTokens;
  return setAuthCookies(NextResponse.json(tokens, { status: 200 }), tokens);
}

async function handleLogout(
  request: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  const accessToken = await resolveAccessToken(request);
  const response = await forwardToBackend(
    request,
    segments,
    "POST",
    { kind: "empty" },
    accessToken,
  );
  const nextResponse = await responseFromBackend(response);
  return clearAuthCookies(nextResponse);
}

async function handleGenericPost(
  request: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  const response = await forwardToBackend(
    request,
    segments,
    "POST",
    await prepareProxyBody(request, "POST"),
  );
  return responseFromBackend(response);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const normalizedPath = path.join("/");

  if (normalizedPath === "me") {
    return handleMe(request);
  }

  return NextResponse.json(
    {
      statusCode: 404,
      message: "Not found",
      code: "NOT_FOUND",
    } satisfies BackendErrorBody,
    { status: 404 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const normalizedPath = path.join("/");

  if (normalizedPath === "login") {
    return handleLogin(request);
  }

  if (normalizedPath === "refresh") {
    return handleRefresh(request);
  }

  if (normalizedPath === "logout" || normalizedPath === "logout-all") {
    return handleLogout(request, path);
  }

  if (
    normalizedPath === "password/reset/request" ||
    normalizedPath === "password/reset/confirm" ||
    normalizedPath === "email/verify" ||
    normalizedPath === "email/resend"
  ) {
    return handleGenericPost(request, path);
  }

  return NextResponse.json(
    {
      statusCode: 404,
      message: "Not found",
      code: "NOT_FOUND",
    } satisfies BackendErrorBody,
    { status: 404 },
  );
}
