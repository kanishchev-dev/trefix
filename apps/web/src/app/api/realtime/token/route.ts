import { NextRequest, NextResponse } from "next/server";

import {
  BackendUnavailableError,
  backendUnavailableResponse,
  fetchBackend,
  isSessionRejection,
} from "@/lib/server/backend-availability";
import { runSingleFlightRefresh, type RefreshedAuthTokens } from "@/lib/server/refresh-single-flight";

export const runtime = "nodejs";

const ACCESS_COOKIE = "trefix_access_token";
const REFRESH_COOKIE = "trefix_refresh_token";
const SESSION_COOKIE = "trefix_session_id";
const BACKEND_BASE_URL =
  process.env.AUTH_BACKEND_URL ?? "http://127.0.0.1:3000/v1";

function sessionExpired(): NextResponse {
  return NextResponse.json(
    { code: "AUTH_TOKEN_INVALID", message: "Session expired" },
    { status: 401 },
  );
}

/**
 * Stores the rotated tokens. The backend spends the refresh token on every
 * exchange, so dropping the new one would make the next refresh look like a
 * replay and the backend would delete the session.
 */
function withAuthCookies(response: NextResponse, tokens: RefreshedAuthTokens): NextResponse {
  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  const refreshMaxAge = 60 * 60 * 24 * 30;
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...common, maxAge: tokens.accessTokenExpiresIn });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...common, maxAge: refreshMaxAge });
  response.cookies.set(SESSION_COOKIE, tokens.sessionId, { ...common, maxAge: refreshMaxAge });
  return response;
}

/**
 * Returns the access token for the current browser session so the client can
 * authenticate the realtime WebSocket connection. The token never leaves the
 * session owner's browser context because the route itself requires the
 * httpOnly session cookies.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    return NextResponse.json({ token: accessToken });
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return sessionExpired();
  }

  try {
    // Single-flight: the page's own requests refresh with the same token at the same time.
    const tokens = await runSingleFlightRefresh(refreshToken, async () => {
      const response = await fetchBackend(`${BACKEND_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        if (isSessionRejection(response.status)) {
          return null;
        }
        throw new BackendUnavailableError(response.status);
      }
      return (await response.json()) as RefreshedAuthTokens;
    });

    if (!tokens) {
      return sessionExpired();
    }
    return withAuthCookies(NextResponse.json({ token: tokens.accessToken }), tokens);
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return backendUnavailableResponse();
    }
    throw error;
  }
}
