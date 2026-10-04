import { io, type Socket } from "socket.io-client";

import {
  REALTIME_INBOUND,
  type RealtimeConnectionStatus,
} from "./realtime-events";

const DEFAULT_BACKEND_PORT = "3000";
const REALTIME_NAMESPACE = "/realtime";

/**
 * Backend origin as the *browser* has to reach it.
 *
 * `AUTH_BACKEND_URL` is deliberately not consulted here. That variable describes
 * the backend as seen from the Next.js process, and a server-side loopback
 * address is meaningless in a browser: opened on another machine, `127.0.0.1`
 * points at *that* machine, so the socket silently never connects and the client
 * stops receiving every update. Only a `NEXT_PUBLIC_` override (which is inlined
 * into the bundle) may replace the default; without one the host is mirrored
 * from the page, which works both on localhost and over the network.
 */
export function resolveSocketOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (configured) {
    return configured.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  }

  // Server render: there is no page origin to mirror, and nothing connects
  // during SSR anyway.
  if (typeof window === "undefined") {
    return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_BACKEND_PORT}`;
}

export type RealtimeEventHandler = (payload: unknown) => void;

export type { RealtimeConnectionStatus };

/**
 * Socket.io realtime client for the admin app.
 *
 * Authenticates with the backend JWT fetched from the httpOnly cookie session.
 */
export class RealtimeClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private rooms: string[] = [];
  /** Rooms the server has actually been told about; reset on every reconnect. */
  private subscribedRooms: string[] = [];
  private eventHandlers = new Map<string, Set<RealtimeEventHandler>>();
  private statusListeners = new Set<(status: RealtimeConnectionStatus) => void>();
  private status: RealtimeConnectionStatus = "disconnected";

  getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  onStatusChange(listener: (status: RealtimeConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Opens the connection and subscribes to `rooms`.
   *
   * The rooms are resolved by the caller from the session permissions, because
   * the gateway rejects the entire subscribe call when any single room is off
   * limits.
   */
  async connect(rooms: readonly string[]): Promise<void> {
    if (this.socket && this.status === "connected") {
      this.subscribe(rooms);
      return;
    }

    this.setStatus("connecting");

    try {
      const response = await fetch("/api/realtime/token", {
        credentials: "include",
      });
      if (!response.ok) {
        this.setStatus("disconnected");
        return;
      }

      const payload = (await response.json()) as { token?: string };
      if (!payload.token) {
        this.setStatus("disconnected");
        return;
      }

      this.connectWithToken(payload.token, rooms);
    } catch {
      // Realtime is optional; the UI still works without it, but say so
      // instead of failing invisibly.
      this.setStatus("disconnected");
      console.warn("Realtime: could not fetch a socket token.");
    }
  }

  connectWithToken(token: string, rooms: readonly string[]): void {
    const nextRooms = [...rooms];

    if (this.socket && this.token === token) {
      this.subscribe(nextRooms);
      return;
    }

    this.disconnect();
    this.token = token;
    this.rooms = nextRooms;

    const origin = resolveSocketOrigin();
    this.socket = io(`${origin}${REALTIME_NAMESPACE}`, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
      // Keep trying: the backend is restarted during development, and giving up
      // after a few attempts would leave the client stale until a page reload.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    // Re-subscribed on every (re)connection: rooms live on the socket, so a
    // reconnect starts out in none of them.
    this.socket.on("connect", () => {
      this.setStatus("connected");
      this.subscribedRooms = [];
      this.subscribe(this.rooms);
    });

    this.socket.on("disconnect", () => {
      this.subscribedRooms = [];
      this.setStatus("disconnected");
    });

    this.socket.on("connect_error", (error) => {
      this.setStatus("disconnected");
      console.warn("Realtime: socket connection failed.", error.message);
    });

    this.socket.onAny((event: string, payload: unknown) => {
      this.dispatch(event, payload);
    });
  }

  private subscribe(rooms: readonly string[]): void {
    this.rooms = [...rooms];

    if (!this.socket || this.rooms.length === 0) {
      return;
    }

    if (this.subscribedRooms.join(",") === this.rooms.join(",")) {
      return;
    }

    this.subscribedRooms = [...this.rooms];
    this.socket.emit(REALTIME_INBOUND.subscribe, { rooms: this.rooms });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
    this.rooms = [];
    this.subscribedRooms = [];
    this.setStatus("disconnected");
  }

  on(event: string, handler: RealtimeEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  private dispatch(event: string, payload: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => {
      handler(payload);
    });
  }

  private setStatus(status: RealtimeConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}