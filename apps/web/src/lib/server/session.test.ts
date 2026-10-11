import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  callWithSession,
  sessionIssuedResponse,
  withoutTokens,
} from "./session";

const tokens = {
  tokenType: "Bearer",
  accessToken: "new-access",
  refreshToken: "new-refresh",
  sessionId: "s1",
  accessTokenExpiresIn: 900,
  user: { id: "u1" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestWithCookies(cookies: Record<string, string>): NextRequest {
  const request = new NextRequest(
    new URL("/api/auth/me", "http://localhost:3001"),
  );
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

describe("session helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refreshes once on an expired token and repeats the call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ code: "AUTH_TOKEN_INVALID" }, 401))
      .mockResolvedValueOnce(json(tokens))
      .mockResolvedValueOnce(json({ id: "u1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callWithSession(
      requestWithCookies({
        trefix_access_token: "old",
        trefix_refresh_token: "refresh-a",
      }),
      "/auth/me",
      "GET",
      { kind: "empty" },
    );

    expect(result?.response.status).toBe(200);
    expect(result?.refreshed?.accessToken).toBe("new-access");
    const retryInit = fetchMock.mock.calls[2]![1] as RequestInit;
    expect(retryInit.headers).toMatchObject({
      authorization: "Bearer new-access",
    });
  });

  it("does not spend the refresh token on a wrong current password", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ code: "AUTH_INVALID_CREDENTIALS" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callWithSession(
      requestWithCookies({
        trefix_access_token: "old",
        trefix_refresh_token: "refresh-b",
      }),
      "/auth/password/change",
      "POST",
      { kind: "empty" },
    );

    expect(result?.response.status).toBe(401);
    expect(result?.refreshed).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an expired session when the refresh is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ code: "AUTH_TOKEN_INVALID" }, 401))
        .mockResolvedValueOnce(
          json({ code: "AUTH_REFRESH_TOKEN_REUSED" }, 401),
        ),
    );

    const result = await callWithSession(
      requestWithCookies({
        trefix_access_token: "old",
        trefix_refresh_token: "refresh-c",
      }),
      "/auth/me",
      "GET",
      { kind: "empty" },
    );

    expect(result).toBeNull();
  });

  it("keeps issued tokens in httpOnly cookies and out of the body", async () => {
    const response = await sessionIssuedResponse(json(tokens));

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("accessToken");
    expect(body).not.toHaveProperty("refreshToken");
    expect(body).toMatchObject({ sessionId: "s1", user: { id: "u1" } });
    expect(response.cookies.get("trefix_refresh_token")).toMatchObject({
      value: "new-refresh",
      httpOnly: true,
    });
  });

  it("strips only the tokens", () => {
    expect(withoutTokens(tokens)).toEqual({
      tokenType: "Bearer",
      sessionId: "s1",
      accessTokenExpiresIn: 900,
      user: { id: "u1" },
    });
  });
});
