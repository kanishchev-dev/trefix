import { type NextRequest, NextResponse } from "next/server";

import { prepareProxyBody } from "@/lib/server/proxy-payload";
import {
  ACCESS_COOKIE,
  callWithSession,
  clearAuthCookies,
  forwardToBackend,
  forwardWithSession,
  refreshSessionTokens,
  responseFromBackend,
  sessionExpiredResponse,
  sessionIssuedResponse,
  setAuthCookies,
  withBackendAvailability,
  withoutTokens,
} from "@/lib/server/session";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

/** Backend auth endpoints that need no session and only pass the body through. */
const PUBLIC_POSTS = new Set([
  "password/reset/request",
  "password/reset/confirm",
  "email/verify",
  "email/resend",
]);

function notFound(): NextResponse {
  return NextResponse.json(
    { statusCode: 404, message: "Not found", code: "NOT_FOUND" },
    { status: 404 },
  );
}

async function routePath(context: RouteContext): Promise<string> {
  const { path } = await context.params;
  return path.join("/");
}

/** Refresh for the browser: new cookies, and the session without its tokens. */
async function handleRefresh(request: NextRequest): Promise<NextResponse> {
  const tokens = await refreshSessionTokens(request);
  if (!tokens) {
    return sessionExpiredResponse();
  }
  return setAuthCookies(
    NextResponse.json(withoutTokens(tokens), { status: 200 }),
    tokens,
  );
}

async function handleLogout(
  request: NextRequest,
  path: string,
): Promise<NextResponse> {
  const accessToken =
    request.cookies.get(ACCESS_COOKIE)?.value ??
    (await refreshSessionTokens(request))?.accessToken ??
    null;
  const response = await forwardToBackend(
    request,
    `/auth/${path}`,
    "POST",
    { kind: "empty" },
    accessToken,
  );
  return clearAuthCookies(await responseFromBackend(response));
}

/** Password change answers with a new session that replaces the current one. */
async function handlePasswordChange(
  request: NextRequest,
): Promise<NextResponse> {
  const payload = await prepareProxyBody(request, "POST");
  const result = await callWithSession(
    request,
    "/auth/password/change",
    "POST",
    payload,
  );
  if (!result) {
    return sessionExpiredResponse();
  }
  const response = await sessionIssuedResponse(result.response);
  // A failed change still has to keep the tokens rotated by the refresh.
  return result.refreshed && !result.response.ok
    ? setAuthCookies(response, result.refreshed)
    : response;
}

export function GET(request: NextRequest, context: RouteContext) {
  return withBackendAvailability(async () => {
    if ((await routePath(context)) !== "me") {
      return notFound();
    }
    return forwardWithSession(request, "/auth/me", "GET", { kind: "empty" });
  });
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return withBackendAvailability(async () => {
    if ((await routePath(context)) !== "me") {
      return notFound();
    }
    return forwardWithSession(
      request,
      "/auth/me",
      "PATCH",
      await prepareProxyBody(request, "PATCH"),
    );
  });
}

export function POST(request: NextRequest, context: RouteContext) {
  return withBackendAvailability(async () => {
    const path = await routePath(context);

    switch (path) {
      case "login":
      case "invite/activate": {
        const payload = await prepareProxyBody(request, "POST");
        return sessionIssuedResponse(
          await forwardToBackend(request, `/auth/${path}`, "POST", payload),
        );
      }
      case "refresh":
        return handleRefresh(request);
      case "logout":
      case "logout-all":
        return handleLogout(request, path);
      case "password/change":
        return handlePasswordChange(request);
      default:
        if (!PUBLIC_POSTS.has(path)) {
          return notFound();
        }
        return responseFromBackend(
          await forwardToBackend(
            request,
            `/auth/${path}`,
            "POST",
            await prepareProxyBody(request, "POST"),
          ),
        );
    }
  });
}
