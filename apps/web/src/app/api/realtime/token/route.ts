import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCESS_COOKIE = "trefix_access_token";
const REFRESH_COOKIE = "trefix_refresh_token";
const BACKEND_BASE_URL =
  process.env.AUTH_BACKEND_URL ?? "http://127.0.0.1:3000/v1";

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
    return NextResponse.json(
      { code: "AUTH_TOKEN_INVALID", message: "Session expired" },
      { status: 401 },
    );
  }

  const refreshResponse = await fetch(`${BACKEND_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!refreshResponse.ok) {
    return NextResponse.json(
      { code: "AUTH_TOKEN_INVALID", message: "Session expired" },
      { status: 401 },
    );
  }

  const tokens = (await refreshResponse.json()) as { accessToken: string };
  return NextResponse.json({ token: tokens.accessToken });
}
