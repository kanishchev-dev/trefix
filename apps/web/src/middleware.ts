import { NextRequest, NextResponse } from "next/server";

import {
  BackendUnavailableError,
  fetchBackend,
  isSessionRejection,
} from "@/lib/server/backend-availability";
import { runSingleFlightRefresh } from "@/lib/server/refresh-single-flight";

// Node.js runtime so this module shares its single-flight map with the route
// handlers below. On the edge runtime each request would get its own isolate
// with its own map, and the guard would protect nothing.
export const runtime = "nodejs";

const BACKEND_BASE_URL =
  process.env.AUTH_BACKEND_URL ?? "http://127.0.0.1:3000/v1";
const ACCESS_COOKIE = "trefix_access_token";
const REFRESH_COOKIE = "trefix_refresh_token";
const SESSION_COOKIE = "trefix_session_id";
const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/activate",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAssetRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  );
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

async function refreshSession(request: NextRequest): Promise<{
  ok: boolean;
  /** The backend did not answer: the session may well be alive. */
  unavailable?: boolean;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    accessTokenExpiresIn: number;
  };
}> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return { ok: false };
  }

  // Single-flight for the same reason as the API proxies. This is the third
  // place that spends the refresh token, and the one most likely to collide
  // with them: the middleware refreshes while the page it is guarding fires its
  // first authenticated requests, and both present the same token. The backend
  // rotates it on every use and deletes the session on the second presentation.
  let tokens: Awaited<ReturnType<typeof runSingleFlightRefresh>>;
  try {
    tokens = await runSingleFlightRefresh(refreshToken, async () => {
      const response = await fetchBackend(`${BACKEND_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        if (isSessionRejection(response.status)) {
          return null;
        }
        throw new BackendUnavailableError(response.status);
      }

      return (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        sessionId: string;
        accessTokenExpiresIn: number;
      };
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return { ok: false, unavailable: true };
    }
    throw error;
  }

  if (!tokens) {
    return { ok: false };
  }

  return { ok: true, tokens };
}

function writeAuthCookies(
  response: NextResponse,
  tokens: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    accessTokenExpiresIn: number;
  },
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  const refreshMaxAge = 60 * 60 * 24 * 30;

  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: tokens.accessTokenExpiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: refreshMaxAge,
  });
  response.cookies.set(SESSION_COOKIE, tokens.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: refreshMaxAge,
  });

  return response;
}

async function ensureActiveSession(
  request: NextRequest,
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const pathname = request.nextUrl.pathname;

  if (isAssetRoute(pathname)) {
    return { allowed: true };
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const accessExpiry = accessToken ? decodeJwtExp(accessToken) : null;
  const accessIsFresh = Boolean(
    accessToken && accessExpiry && accessExpiry > Date.now(),
  );

  if (isPublicRoute(pathname)) {
    if (accessIsFresh || refreshToken) {
      const refreshed = accessIsFresh
        ? null
        : await refreshSession(request).catch(() => null);

      if (accessIsFresh) {
        return {
          allowed: false,
          response: NextResponse.redirect(new URL("/", request.url)),
        };
      }

      if (refreshed?.ok && refreshed.tokens) {
        const response = NextResponse.redirect(new URL("/", request.url));
        return {
          allowed: false,
          response: writeAuthCookies(response, refreshed.tokens),
        };
      }
    }

    return { allowed: true };
  }

  if (accessIsFresh) {
    return { allowed: true };
  }

  if (refreshToken) {
    const refreshed = await refreshSession(request).catch(() => null);
    if (refreshed?.ok && refreshed.tokens) {
      const response = NextResponse.next();
      return {
        allowed: true,
        response: writeAuthCookies(response, refreshed.tokens),
      };
    }
    if (refreshed?.unavailable) {
      // Keep the cookies and let the page render its "backend unavailable"
      // state: logging the user out because the backend restarted is wrong,
      // and /login would bounce straight back here.
      return { allowed: true };
    }
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  clearAuthCookies(response);
  return { allowed: false, response };
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const result = await ensureActiveSession(request);
  return result.response ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
