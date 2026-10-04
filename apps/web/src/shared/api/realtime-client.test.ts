import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sockets: FakeSocket[] = [];

class FakeSocket {
  url = "";
  options: Record<string, unknown> = {};
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    this.handlers[event] = handler;
    return this;
  });
  onAny = vi.fn(() => this);
  emit = vi.fn();
  removeAllListeners = vi.fn();
  disconnect = vi.fn();
  handlers: Record<string, (...args: unknown[]) => void> = {};
}

vi.mock("socket.io-client", () => ({
  io: vi.fn((url: string, options: Record<string, unknown>) => {
    const socket = new FakeSocket();
    sockets.push(socket);
    Object.assign(socket, { url, options });
    return socket;
  }),
}));

import { RealtimeClient, resolveSocketOrigin } from "./realtime-client";

function stubTokenFetch(token: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ token }), { status: 200 })),
  );
}

function lastSocket(): FakeSocket {
  const socket = sockets[sockets.length - 1];

  if (!socket) {
    throw new Error("No socket was created");
  }

  return socket;
}

function subscribeCalls(socket: FakeSocket): unknown[][] {
  return socket.emit.mock.calls.filter(
    (call) => call[0] === "realtime.subscribe",
  );
}

describe("RealtimeClient", () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "192.168.0.168",
      host: "192.168.0.168:3001",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /**
   * Regression: the rooms were remembered before the socket existed, so the
   * de-duplication believed the subscription had already been sent and the
   * client silently joined no room at all — connected, but deaf.
   */
  it("subscribes to the rooms once the socket connects", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    await client.connect(["users", "settings"]);

    // Nothing may be sent before the socket is actually up.
    expect(subscribeCalls(lastSocket())).toHaveLength(0);

    lastSocket().handlers.connect();

    expect(subscribeCalls(lastSocket())).toEqual([
      ["realtime.subscribe", { rooms: ["users", "settings"] }],
    ]);
  });

  it("resubscribes after a reconnect, because rooms do not survive it", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    await client.connect(["users"]);

    const socket = lastSocket();
    socket.handlers.connect();
    socket.handlers.disconnect();
    socket.handlers.connect();

    expect(subscribeCalls(socket)).toHaveLength(2);
  });

  it("does not resubscribe the same rooms over and over", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    await client.connect(["users"]);

    const socket = lastSocket();
    socket.handlers.connect();
    await client.connect(["users"]);

    expect(subscribeCalls(socket)).toHaveLength(1);
  });

  it("resubscribes when the granted rooms actually change", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    await client.connect(["users"]);

    const socket = lastSocket();
    socket.handlers.connect();
    await client.connect(["users", "settings"]);

    expect(subscribeCalls(socket)).toEqual([
      ["realtime.subscribe", { rooms: ["users"] }],
      ["realtime.subscribe", { rooms: ["users", "settings"] }],
    ]);
  });

  it("connects to the realtime namespace on the mirrored host", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    await client.connect(["users"]);

    expect(lastSocket().url).toBe("http://192.168.0.168:3000/realtime");
  });

  it("keeps trying to connect after the backend comes back", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    await client.connect(["users"]);

    expect(lastSocket().options).toMatchObject({
      transports: ["websocket"],
      reconnection: true,
      // A bounded number of attempts left the client stale for good after a
      // backend restart.
      reconnectionAttempts: Infinity,
    });
  });

  it("does not connect without a token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    const client = new RealtimeClient();
    await client.connect(["users"]);

    expect(sockets).toHaveLength(0);
    expect(client.getStatus()).toBe("disconnected");
  });

  it("reports the connection status to listeners", async () => {
    stubTokenFetch("jwt");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const client = new RealtimeClient();
    const seen: string[] = [];
    client.onStatusChange((status) => seen.push(status));

    await client.connect(["users"]);
    lastSocket().handlers.connect();

    expect(seen).toContain("connected");

    lastSocket().handlers.disconnect();
    expect(seen[seen.length - 1]).toBe("disconnected");
  });

  it("dispatches only events somebody subscribed to", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    const received: unknown[] = [];
    client.on("user.updated", (payload) => received.push(payload));

    await client.connect(["users"]);
    const anyHandler = (
      lastSocket().onAny as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0][0] as (event: string, payload: unknown) => void;

    anyHandler("user.updated", { meta: {} });
    anyHandler("training.workout.completed", { meta: {} });

    expect(received).toEqual([{ meta: {} }]);
  });

  it("resolves the same origin for the client and for the fallback", () => {
    expect(resolveSocketOrigin()).toBe("http://192.168.0.168:3000");
  });
});