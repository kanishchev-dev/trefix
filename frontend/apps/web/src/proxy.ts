import { NextRequest, NextResponse } from "next/server";

import { BackendUnavailableError } from "@/lib/server/backend-availability";
import {
  ACCESS_COOKIE,
  clearAuthCookies,
  REFRESH_COOKIE,
  refreshSessionTokens,
  type SessionTokens,
  setAuthCookies,
} from "@/lib/server/session";

// Proxy always runs on the Node.js runtime (Next 16), so it shares the
// single-flight refresh map with the route handlers: the proxy refreshes while
// the page it guards fires its first authenticated requests, and both present
// the same token, which the backend rotates on every use.

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

async function refreshSession(
  request: NextRequest,
): Promise<{ ok: boolean; unavailable?: boolean; tokens?: SessionTokens }> {
  try {
    const tokens = await refreshSessionTokens(request);
    return tokens ? { ok: true, tokens } : { ok: false };
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      // The backend did not answer: the session may well be alive.
      return { ok: false, unavailable: true };
    }
    throw error;
  }
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
          response: setAuthCookies(response, refreshed.tokens),
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
        response: setAuthCookies(response, refreshed.tokens),
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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const result = await ensureActiveSession(request);
  return result.response ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
