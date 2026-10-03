import { type NextRequest, NextResponse } from "next/server";

import {
  payloadToFetchInit,
  prepareProxyBody,
  type ProxyPayload,
} from "@/lib/server/proxy-payload";

export const runtime = "nodejs";

const BACKEND_BASE_URL =
  process.env.AUTH_BACKEND_URL ?? "http://127.0.0.1:3000/v1";
const ACCESS_COOKIE = "trefix_access_token";
const REFRESH_COOKIE = "trefix_refresh_token";
const SESSION_COOKIE = "trefix_session_id";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessTokenExpiresIn: number;
};

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

function buildBackendPath(segments: string[] | undefined): string {
  return `/${(segments ?? []).join("/")}`;
}

function buildQueryString(request: NextRequest): string {
  const search = request.nextUrl.search;
  return search.length > 0 ? search : "";
}

async function forwardToBackend(
  request: NextRequest,
  segments: string[] | undefined,
  method: HttpMethod,
  payload: ProxyPayload,
  accessToken?: string | null,
) {
  const { body, headers, duplex } = payloadToFetchInit(payload);

  return fetch(
    `${BACKEND_BASE_URL}${buildBackendPath(segments)}${buildQueryString(request)}`,
    {
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
      cache: "no-store",
    } as RequestInit,
  );
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

async function refreshIfNeeded(request: NextRequest): Promise<AuthTokens | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(`${BACKEND_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthTokens;
}

async function handleRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: HttpMethod,
): Promise<NextResponse> {
  const { path } = await context.params;
  const payload = await prepareProxyBody(request, method);
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;

  let response = await forwardToBackend(
    request,
    path,
    method,
    payload,
    accessToken,
  );

  if (response.status === 401) {
    const refreshedTokens = await refreshIfNeeded(request);
    if (!refreshedTokens) {
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

    response = await forwardToBackend(
      request,
      path,
      method,
      payload,
      refreshedTokens.accessToken,
    );
    const nextResponse = await responseFromBackend(response);
    return setAuthCookies(nextResponse, refreshedTokens);
  }

  return responseFromBackend(response);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, context, "GET");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, context, "POST");
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, context, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, context, "DELETE");
}
