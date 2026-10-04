import { describe, expect, it, vi } from "vitest";

import { runSingleFlightRefresh, type RefreshedAuthTokens } from "./refresh-single-flight";

function tokens(refreshToken: string): RefreshedAuthTokens {
  return {
    accessToken: `access-${refreshToken}`,
    refreshToken,
    sessionId: "session-1",
    accessTokenExpiresIn: 900,
  };
}

/** A promise the test resolves by hand, to hold exchanges open. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("runSingleFlightRefresh", () => {
  /**
   * The regression. After a sign-in redirect the first batch of queries fails
   * together; each one exchanged the same refresh token on its own, the second
   * exchange replayed a spent token, and the backend deleted the session. The
   * user was left with a partial menu and 401s everywhere.
   */
  it("exchanges a refresh token once for a burst of concurrent callers", async () => {
    const exchange = vi.fn(async () => tokens("next-1"));
    const gate = deferred<RefreshedAuthTokens | null>();

    const first = runSingleFlightRefresh("token-a", () => {
      exchange();
      return gate.promise;
    });
    const second = runSingleFlightRefresh("token-a", exchange);
    const third = runSingleFlightRefresh("token-a", exchange);

    gate.resolve(tokens("next-1"));

    const results = await Promise.all([first, second, third]);

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });

  /**
   * A request that failed a moment earlier still has the previous token in its
   * own cookie snapshot. Answering it with anything but the fresh tokens would
   * start the very same cascade one round later.
   */
  it("answers a late caller with the fresh tokens instead of spending them again", async () => {
    const exchange = vi.fn(async () => tokens("next-2"));

    await runSingleFlightRefresh("token-b", exchange);
    const late = await runSingleFlightRefresh("token-b", exchange);

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(late).toEqual(tokens("next-2"));
  });

  it("never lets a failed exchange poison later attempts", async () => {
    const failing = vi.fn(async () => null);

    expect(await runSingleFlightRefresh("token-c", failing)).toBeNull();
    expect(await runSingleFlightRefresh("token-c", failing)).toBeNull();

    // A rejected token must not be remembered as "already refreshed", or the
    // next attempt would be skipped and the app stuck signed out.
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("keeps different sessions independent", async () => {
    const exchangeA = vi.fn(async () => tokens("next-a"));
    const exchangeB = vi.fn(async () => tokens("next-b"));

    const [a, b] = await Promise.all([
      runSingleFlightRefresh("token-x", exchangeA),
      runSingleFlightRefresh("token-y", exchangeB),
    ]);

    expect(exchangeA).toHaveBeenCalledTimes(1);
    expect(exchangeB).toHaveBeenCalledTimes(1);
    expect(a).not.toBe(b);
  });
});