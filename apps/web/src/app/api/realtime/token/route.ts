import { type NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  refreshSessionTokens,
  sessionExpiredResponse,
  setAuthCookies,
  withBackendAvailability,
} from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Returns the access token for the current browser session so the client can
 * authenticate the realtime WebSocket connection. The token never leaves the
 * session owner's browser context because the route itself requires the
 * httpOnly session cookies.
 */
export function GET(request: NextRequest): Promise<NextResponse> {
  return withBackendAvailability(async () => {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
    if (accessToken) {
      return NextResponse.json({ token: accessToken });
    }

    const tokens = await refreshSessionTokens(request);
    if (!tokens) {
      return sessionExpiredResponse();
    }
    return setAuthCookies(
      NextResponse.json({ token: tokens.accessToken }),
      tokens,
    );
  });
}
