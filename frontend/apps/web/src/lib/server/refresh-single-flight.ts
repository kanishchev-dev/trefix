/**
 * Single-flight guard around the refresh-token exchange.
 *
 * The backend rotates the refresh token on every use and treats a second
 * presentation of a spent token as theft: it deletes the session outright.
 *
 * That is the right call for a stolen token and catastrophic for a browser that
 * simply has several requests failing at once. Right after a sign-in redirect
 * the app fires its first batch of queries — the user list and the presence
 * lookup among them — they fail together, and each one independently attempted
 * the refresh. The first exchange consumed the token, the rest looked exactly
 * like replay, and the session was destroyed mid-login: every subsequent
 * request answered 401 and the app was left without a menu.
 *
 * The backend cannot make this idempotent itself — it stores only a hash, so a
 * replayed token's replacement cannot be handed out again. It has to be
 * prevented at the caller, which is what this does.
 */

export type RefreshedAuthTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessTokenExpiresIn: number;
};

/**
 * How long a successful exchange is replayed for requests that still carry the
 * token it replaced.
 *
 * A request that 401'd a moment earlier has the previous token baked into its
 * own cookie snapshot, so answering it with the *old* result would start the
 * same cascade. The window only has to span the burst of parallel failures.
 */
const SETTLED_REUSE_MS = 5_000;

const inFlight = new Map<string, Promise<RefreshedAuthTokens | null>>();
const settled = new Map<
  string,
  { tokens: RefreshedAuthTokens; expiresAt: number }
>();

function prune(now: number): void {
  for (const [token, entry] of settled) {
    if (entry.expiresAt <= now) {
      settled.delete(token);
    }
  }
}

/**
 * Runs `exchange` at most once per refresh token.
 *
 * Concurrent callers share the first call's promise; callers that arrive just
 * after it settles get the fresh tokens rather than spending the spent one.
 */
export function runSingleFlightRefresh(
  refreshToken: string,
  exchange: () => Promise<RefreshedAuthTokens | null>,
): Promise<RefreshedAuthTokens | null> {
  const pending = inFlight.get(refreshToken);
  if (pending) {
    return pending;
  }

  const now = Date.now();
  prune(now);

  const recent = settled.get(refreshToken);
  if (recent && recent.expiresAt > now) {
    return Promise.resolve(recent.tokens);
  }

  const promise = exchange()
    .then((tokens) => {
      if (tokens) {
        settled.set(refreshToken, {
          tokens,
          expiresAt: Date.now() + SETTLED_REUSE_MS,
        });
      } else {
        // The token is spent or rejected; keeping the failure around would make
        // every later request skip a refresh that might now succeed.
        settled.delete(refreshToken);
      }

      return tokens;
    })
    .finally(() => {
      inFlight.delete(refreshToken);
    });

  inFlight.set(refreshToken, promise);

  return promise;
}
