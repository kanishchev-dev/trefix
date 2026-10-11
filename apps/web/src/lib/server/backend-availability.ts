import { NextResponse } from "next/server";

/**
 * The backend did not answer (connection refused, DNS, timeout) or answered
 * with a server-side failure. Says nothing about the session: cookies must be
 * kept and the visitor must not be sent to /login, or a backend restart turns
 * into a redirect loop between /login (which sees a fresh access cookie and
 * goes back to /) and the dashboard (which cannot load the user).
 */
export class BackendUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Backend is unavailable");
    this.name = "BackendUnavailableError";
    this.cause = cause;
  }
}

/** `fetch` that turns a network failure into `BackendUnavailableError`. */
export async function fetchBackend(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw new BackendUnavailableError(error);
  }
}

/**
 * A refresh answer that means "this session is over". Anything else that is
 * not a success (5xx, 429) is the backend failing, not the session.
 */
export function isSessionRejection(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

/** What the API proxies answer while the backend is down; cookies stay untouched. */
export function backendUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      statusCode: 503,
      message: "Backend is unavailable",
      code: "BACKEND_UNAVAILABLE",
    },
    { status: 503 },
  );
}
