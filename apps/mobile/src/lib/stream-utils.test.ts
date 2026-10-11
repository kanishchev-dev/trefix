import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./backend-url", () => ({ BACKEND_BASE_URL: "https://api.test/v1" }));
vi.mock("./auth-session", () => ({
  loadAuthSession: vi.fn(async () => ({ accessToken: "token" })),
}));
const refreshAuthTokens = vi.fn();
vi.mock("./auth-api", () => ({ refreshAuthTokens: () => refreshAuthTokens() }));

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/** Minimal XMLHttpRequest driven by the test. */
class FakeXhr {
  static instances: FakeXhr[] = [];
  readyState = 0;
  status = 0;
  responseText = "";
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: string | null = null;
  onreadystatechange: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.instances.push(this);
  }
  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  send(body: string): void {
    this.body = body;
  }
  abort(): void {
    this.onabort?.();
  }
  /** Delivers more of the body; `done` completes the response. */
  deliver(status: number, text: string, done: boolean): void {
    this.status = status;
    this.responseText += text;
    this.readyState = done ? 4 : 3;
    this.onreadystatechange?.();
  }
}

const { postSseStream } = await import("./stream-utils");

async function collect(
  iterator: AsyncIterableIterator<{ delta?: string; isDone: boolean }>,
) {
  const events = [];
  for await (const event of iterator) {
    events.push(event);
  }
  return events;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("postSseStream", () => {
  beforeEach(() => {
    FakeXhr.instances = [];
    refreshAuthTokens.mockReset();
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts the body and yields events split across chunks", async () => {
    const stream = await postSseStream("/coach/sessions/s1/stream", {
      message: "Hi",
    });
    const xhr = FakeXhr.instances[0]!;
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("https://api.test/v1/coach/sessions/s1/stream");
    expect(JSON.parse(xhr.body!)).toEqual({ message: "Hi" });
    expect(xhr.headers.Authorization).toBe("Bearer token");

    xhr.deliver(200, 'data: {"delta":"Hel', false);
    xhr.deliver(200, 'lo","isDone":false}\n\ndata: {"isDone":true}\n\n', true);

    await expect(collect(stream)).resolves.toEqual([
      { delta: "Hello", isDone: false },
      { isDone: true },
    ]);
  });

  it("fails with the backend error code instead of an empty reply", async () => {
    const stream = await postSseStream("/coach/sessions/s1/stream", {
      message: "Hi",
    });
    FakeXhr.instances[0]!.deliver(
      403,
      '{"code":"COACH_DISABLED","message":"Coach is off"}',
      true,
    );

    await expect(collect(stream)).rejects.toMatchObject({
      status: 403,
      code: "COACH_DISABLED",
    });
  });

  it("ends with an error when the server reports a failure mid-stream", async () => {
    const stream = await postSseStream("/coach/sessions/s1/stream", {
      message: "Hi",
    });
    FakeXhr.instances[0]!.deliver(
      200,
      'data: {"delta":"A","isDone":false}\n\nevent: error\ndata: {"code":"COACH_STREAM_FAILED"}\n\n',
      true,
    );

    const received: string[] = [];
    await expect(
      (async () => {
        for await (const event of stream) received.push(event.delta ?? "");
      })(),
    ).rejects.toMatchObject({ code: "COACH_STREAM_FAILED" });
    expect(received).toEqual(["A"]);
  });

  it("refreshes the token once on 401 and streams the repeated request", async () => {
    refreshAuthTokens.mockResolvedValueOnce({ accessToken: "token" });
    const stream = await postSseStream("/coach/sessions/s1/stream", {
      message: "Hi",
    });
    FakeXhr.instances[0]!.deliver(401, '{"code":"AUTH_TOKEN_INVALID"}', true);
    await flush();
    await flush();

    expect(FakeXhr.instances).toHaveLength(2);
    FakeXhr.instances[1]!.deliver(200, 'data: {"isDone":true}\n\n', true);
    await expect(collect(stream)).resolves.toEqual([{ isDone: true }]);
  });
});
