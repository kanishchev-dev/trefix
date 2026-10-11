import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REALTIME_HEARTBEAT_INTERVAL_MS,
  REALTIME_PING_TIMEOUT_MS,
} from "./realtime-client";

const sockets: FakeSocket[] = [];

class FakeSocket {
  url = "";
  options: Record<string, unknown> = {};
  connected = false;
  /** Ping acks, resolved or rejected by the test. */
  pingAck: (error: Error | null) => void = () => undefined;
  /** Timeouts requested for `realtime.ping`, in order. */
  pingTimeouts: number[] = [];
  /** Subscribe acks, so a test can confirm or reject a subscription. */
  subscribeAcks: ((error: Error | null, response?: unknown) => void)[] = [];
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    this.handlers[event] = handler;
    return this;
  });
  onAny = vi.fn(() => this);
  emit = vi.fn();
  connect = vi.fn(() => {
    this.connected = true;
  });
  disconnect = vi.fn(() => {
    this.connected = false;
  });
  removeAllListeners = vi.fn();
  timeout = vi.fn((ms: number) => ({
    emit: (
      event: string,
      payloadOrAck?: unknown,
      maybeAck?: (error: Error | null, response?: unknown) => void,
    ) => {
      const ack =
        typeof payloadOrAck === "function"
          ? (payloadOrAck as (error: Error | null) => void)
          : maybeAck;

      if (event === "realtime.ping") {
        this.pingTimeouts.push(ms);
        if (ack) {
          this.pingAck = ack;
        }
        return this;
      }

      // Routed through `emit` as well so assertions on emitted frames keep
      // describing what the client actually sent.
      this.emit(event, payloadOrAck, ack);
      if (ack) {
        this.subscribeAcks.push(ack);
      }
      return this;
    },
  }));
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

/** Subscribe payloads without the acknowledgement callback trailing them. */
function subscribePayloads(socket: FakeSocket): unknown[] {
  return subscribeCalls(socket).map((call) => call[1]);
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

    expect(subscribePayloads(lastSocket())).toEqual([
      { rooms: ["users", "settings"] },
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

    expect(subscribePayloads(socket)).toEqual([
      { rooms: ["users"] },
      { rooms: ["users", "settings"] },
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

  /**
   * Regression for the failure this whole feature stalled on. Subscribing in a
   * frame sent right after `connect` races the server, which authenticates
   * asynchronously: the backend can reject the subscription for arriving before
   * the socket was authenticated, leaving a socket that reports "connected" and
   * belongs to no room, so no event ever arrives again. Carrying the rooms in
   * the handshake removes the second round trip the race depended on.
   */
  it("carries the rooms in the handshake instead of racing a follow-up frame", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    await client.connect(["users", "settings"]);

    expect(lastSocket().options.auth).toEqual({
      token: "jwt",
      rooms: ["users", "settings"],
    });
  });

  it("retries the subscription after the server rejects it", async () => {
    stubTokenFetch("jwt");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const client = new RealtimeClient();
    await client.connect(["users"]);

    const socket = lastSocket();
    socket.handlers.connect();
    socket.subscribeAcks[0](new Error("WS_NOT_AUTHENTICATED"));

    expect(warn).toHaveBeenCalled();

    // The rejected attempt must not be remembered as granted, otherwise the
    // retry is skipped and the socket stays in no room for good.
    socket.handlers.disconnect();
    socket.handlers.connect();

    expect(subscribeCalls(socket)).toHaveLength(2);
  });

  it("retries when the backend grants fewer rooms than requested", async () => {
    stubTokenFetch("jwt");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const client = new RealtimeClient();
    await client.connect(["users", "settings"]);

    const socket = lastSocket();
    socket.handlers.connect();
    socket.subscribeAcks[0](null, { rooms: ["users"] });

    socket.handlers.disconnect();
    socket.handlers.connect();

    expect(subscribeCalls(socket)).toHaveLength(2);
  });

  it("keeps a confirmed subscription from being sent again", async () => {
    stubTokenFetch("jwt");

    const client = new RealtimeClient();
    await client.connect(["users"]);

    const socket = lastSocket();
    socket.handlers.connect();
    socket.subscribeAcks[0](null, { rooms: ["users"] });

    await client.connect(["users"]);

    expect(subscribeCalls(socket)).toHaveLength(1);
  });
});
/**
 * The regression that made "live updates" stop silently: a socket whose far end
 * vanished (sleeping laptop, switched network) stayed `connected` in the
 * client, so no event ever arrived again and the UI only caught up on a manual
 * reload. An unanswered ping is what turns that into a reconnect.
 */
describe("RealtimeClient heartbeat", () => {
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
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function connectClient() {
    stubTokenFetch("jwt");
    const client = new RealtimeClient();
    await client.connect(["users"]);
    const socket = lastSocket();
    socket.handlers.connect();
    return { client, socket };
  }

  it("pings the backend on a timer once connected", async () => {
    vi.useFakeTimers();
    const { socket } = await connectClient();

    expect(socket.pingTimeouts).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(REALTIME_HEARTBEAT_INTERVAL_MS);

    expect(socket.pingTimeouts).toEqual([REALTIME_PING_TIMEOUT_MS]);
  });

  it("rebuilds the socket when a ping goes unanswered", async () => {
    vi.useFakeTimers();
    const { client, socket } = await connectClient();

    await vi.advanceTimersByTimeAsync(REALTIME_HEARTBEAT_INTERVAL_MS);
    socket.pingAck(new Error("timed out"));

    expect(socket.connect).toHaveBeenCalled();
    expect(client.getStatus()).toBe("connecting");
  });

  it("stays connected and does not reconnect when the ping is answered", async () => {
    vi.useFakeTimers();
    const { client, socket } = await connectClient();

    await vi.advanceTimersByTimeAsync(REALTIME_HEARTBEAT_INTERVAL_MS);
    socket.pingAck(null);

    expect(socket.connect).not.toHaveBeenCalled();
    expect(client.getStatus()).toBe("connected");
  });

  it("resubscribes after recovering, since rooms do not survive a new socket", async () => {
    vi.useFakeTimers();
    const { socket } = await connectClient();

    await vi.advanceTimersByTimeAsync(REALTIME_HEARTBEAT_INTERVAL_MS);
    socket.pingAck(new Error("timed out"));
    socket.handlers.connect();

    const subscribeCalls = socket.emit.mock.calls.filter(
      (call) => call[0] === "realtime.subscribe",
    );

    expect(subscribeCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("stops pinging once the client is torn down", async () => {
    vi.useFakeTimers();
    const { client, socket } = await connectClient();

    client.disconnect();
    await vi.advanceTimersByTimeAsync(REALTIME_HEARTBEAT_INTERVAL_MS * 3);

    expect(socket.pingTimeouts).toHaveLength(0);
  });
});
