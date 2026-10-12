import { ApiClientError, type ApiErrorShape } from "@trefix/api-client";

import { backendHeaders } from "./api-client";
import { BACKEND_BASE_URL } from "./backend-url";
import { logger } from "./logger";

export interface StreamEvent {
  delta?: string;
  isDone: boolean;
}

type StreamItem =
  | { kind: "event"; event: StreamEvent }
  | { kind: "error"; error: Error }
  | { kind: "end" };

const STREAM_ERROR_CODE = "COACH_STREAM_FAILED";

function errorFromBody(status: number, body: string): ApiClientError {
  let parsed: ApiErrorShape | null = null;
  try {
    parsed = JSON.parse(body) as ApiErrorShape;
  } catch {
    // Not JSON: a proxy or gateway page.
  }
  return new ApiClientError(
    parsed?.message ?? `Stream failed with status ${status}`,
    status,
    parsed?.code,
    parsed,
  );
}

/**
 * POSTs a JSON body and reads the server-sent events of the answer.
 *
 * XMLHttpRequest because React Native's fetch does not expose a streaming
 * body. A non-2xx answer becomes an `ApiClientError` (after one token refresh
 * on 401), and an `event: error` from the server ends the stream with one, so
 * a failure is never mistaken for an empty reply.
 */
export async function postSseStream(
  path: string,
  body: unknown,
  abortSignal?: AbortSignal,
): Promise<AsyncIterableIterator<StreamEvent>> {
  const queue: StreamItem[] = [];
  let waiting: ((item: StreamItem) => void) | null = null;
  let finished = false;

  const push = (item: StreamItem): void => {
    if (finished) {
      return;
    }
    if (item.kind !== "event") {
      finished = true;
    }
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(item);
    } else {
      queue.push(item);
    }
  };

  const open = async (canRefresh: boolean): Promise<void> => {
    const headers = await backendHeaders(true);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BACKEND_BASE_URL}${path}`);
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("Content-Type", "application/json");
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }

    let position = 0;
    let buffer = "";
    let pendingEvent: string | null = null;
    const isSuccess = (): boolean => xhr.status >= 200 && xhr.status < 300;

    const consumeLines = (): void => {
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          pendingEvent = null;
          continue;
        }
        if (line.startsWith("event:")) {
          pendingEvent = line.slice(6).trim();
          continue;
        }
        if (!line.startsWith("data:")) {
          continue;
        }
        const data = line.slice(5).trim();
        if (pendingEvent === "error") {
          push({
            kind: "error",
            error: new ApiClientError(
              "Coach reply failed",
              502,
              STREAM_ERROR_CODE,
            ),
          });
          continue;
        }
        try {
          push({ kind: "event", event: JSON.parse(data) as StreamEvent });
        } catch {
          logger.warn("[Stream] Skipped a malformed event");
        }
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState < 3 || !isSuccess()) {
        if (xhr.readyState === 4 && !isSuccess() && xhr.status !== 0) {
          if (xhr.status === 401 && canRefresh) {
            void import("./auth-api")
              .then(({ refreshAuthTokens }) => refreshAuthTokens())
              .then((tokens) =>
                tokens
                  ? open(false)
                  : push({
                      kind: "error",
                      error: errorFromBody(401, xhr.responseText),
                    }),
              )
              .catch((error: unknown) =>
                push({
                  kind: "error",
                  error:
                    error instanceof Error ? error : new Error(String(error)),
                }),
              );
            return;
          }
          push({
            kind: "error",
            error: errorFromBody(xhr.status, xhr.responseText),
          });
        }
        return;
      }

      buffer += xhr.responseText.slice(position);
      position = xhr.responseText.length;
      consumeLines();
      if (xhr.readyState === 4) {
        push({ kind: "end" });
      }
    };
    xhr.onerror = () =>
      push({
        kind: "error",
        error: new Error("Network error while streaming"),
      });
    xhr.onabort = () => push({ kind: "end" });
    abortSignal?.addEventListener("abort", () => xhr.abort());

    xhr.send(JSON.stringify(body));
  };

  await open(true);

  const iterator: AsyncIterableIterator<StreamEvent> = {
    async next(): Promise<IteratorResult<StreamEvent>> {
      if (finished && queue.length === 0) {
        return { value: undefined, done: true };
      }
      const item =
        queue.shift() ??
        (await new Promise<StreamItem>((resolve) => (waiting = resolve)));
      if (item.kind === "event") {
        return { value: item.event, done: false };
      }
      if (item.kind === "error") {
        throw item.error;
      }
      return { value: undefined, done: true };
    },
    [Symbol.asyncIterator]: () => iterator,
  };
  return iterator;
}
