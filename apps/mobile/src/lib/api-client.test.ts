import { ApiClientError } from "@trefix/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  accessToken: "old-access",
  refreshToken: "refresh",
  sessionId: "s1",
  accessTokenExpiresIn: 900,
};

vi.mock("./backend-url", () => ({ BACKEND_BASE_URL: "https://api.test/v1" }));
vi.mock("./auth-session", () => ({
  loadAuthSession: vi.fn(async () => session),
  saveAuthSession: vi.fn(async () => undefined),
}));
const refreshAuthTokens = vi.fn();
vi.mock("./auth-api", () => ({ refreshAuthTokens: () => refreshAuthTokens() }));

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { authorizedFetch, request, setRequestLanguage } = await import(
  "./api-client"
);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("mobile api client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    refreshAuthTokens.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setRequestLanguage("ru");
    session.accessToken = "old-access";
  });

  afterEach(() => vi.unstubAllGlobals());

  it("sends the token and the app language", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await request("/auth/me", { useAuth: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/v1/auth/me");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer old-access",
      "Accept-Language": "ru",
    });
  });

  it("refreshes once on 401 and repeats the call with the new token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "AUTH_TOKEN_INVALID" }, 401),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "u1" }));
    refreshAuthTokens.mockImplementationOnce(async () => {
      session.accessToken = "new-access";
      return session;
    });

    await expect(request("/auth/me", { useAuth: true })).resolves.toEqual({
      id: "u1",
    });

    expect(refreshAuthTokens).toHaveBeenCalledTimes(1);
    const retry = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(retry[1].headers).toMatchObject({
      Authorization: "Bearer new-access",
    });
  });

  it("reports 401 when the session is rejected", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "AUTH_SESSION_NOT_FOUND" }, 401),
    );
    refreshAuthTokens.mockResolvedValueOnce(null);

    const error = await request("/auth/me", { useAuth: true }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 401,
      code: "AUTH_SESSION_NOT_FOUND",
    });
  });

  it("keeps a network failure during refresh a network failure, not a 401", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));
    refreshAuthTokens.mockRejectedValueOnce(
      new TypeError("Network request failed"),
    );

    await expect(
      authorizedFetch("/auth/me", { method: "GET" }, { useAuth: true }),
    ).rejects.toThrow("Network request failed");
  });

  it("does not refresh for unauthenticated calls", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "AUTH_INVALID_CREDENTIALS" }, 401),
    );

    await expect(
      request("/auth/login", { method: "POST", body: {} }),
    ).rejects.toMatchObject({ status: 401 });
    expect(refreshAuthTokens).not.toHaveBeenCalled();
  });

  it("treats an empty 200 body as no content", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(
      request("/coach/sessions", { method: "DELETE", useAuth: true }),
    ).resolves.toBeUndefined();
  });
});
