import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { middleware } from "./middleware";

function jwt(expiresInSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds })).toString(
    "base64url",
  );
  return `header.${payload}.signature`;
}

function requestFor(path: string, cookies: Record<string, string>): NextRequest {
  const request = new NextRequest(new URL(path, "http://localhost:3001"));
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

const isRedirectTo = (response: Response, path: string): boolean =>
  response.status >= 300 && response.status < 400 && new URL(response.headers.get("location") ?? "").pathname === path;

describe("middleware while the backend is down", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets a dashboard page through with an expired access token instead of logging out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const response = await middleware(
      requestFor("/dashboard", { trefix_access_token: jwt(-60), trefix_refresh_token: "refresh-unavailable" }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("trefix_refresh_token")).toBeUndefined();
  });

  it("treats a 5xx from the refresh endpoint as unavailability, not a dead session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 502 })));

    const response = await middleware(
      requestFor("/dashboard", { trefix_access_token: jwt(-60), trefix_refresh_token: "refresh-502" }),
    );

    expect(response.headers.get("location")).toBeNull();
  });

  it("still sends a rejected session to /login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));

    const response = await middleware(
      requestFor("/dashboard", { trefix_access_token: jwt(-60), trefix_refresh_token: "refresh-revoked" }),
    );

    expect(isRedirectTo(response, "/login")).toBe(true);
  });
});
