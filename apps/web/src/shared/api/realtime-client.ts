import { io, type Socket } from "socket.io-client";

const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:3000";

function resolveSocketOrigin(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.AUTH_BACKEND_URL ??
    DEFAULT_BACKEND_ORIGIN;

  // Strip the REST versioning suffix to get the WS origin.
  return envUrl.replace(/\/v1\/?$/, "");
}

export type RealtimeEventHandler = (payload: unknown) => void;

export type RealtimeConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected";

/**
 * Socket.io realtime client for the admin app.
 * Authenticates with the backend JWT fetched from the httpOnly cookie session.
 */
export class RealtimeClient {
  private socket: Socket | null = null;
  private token: string | null = null;
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

  async connect(): Promise<void> {
    if (this.socket && this.status === "connected") {
      return;
    }

    try {
      const response = await fetch("/api/realtime/token", {
        credentials: "include",
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { token?: string };
      if (!payload.token) {
        return;
      }

      this.connectWithToken(payload.token);
    } catch {
      // Realtime is optional; UI still works without it.
    }
  }

  connectWithToken(token: string): void {
    if (this.socket && this.token === token) {
      return;
    }

    this.disconnect();
    this.token = token;

    const origin = resolveSocketOrigin();
    this.socket = io(`${origin}/realtime`, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on("connect", () => {
      this.setStatus("connected");
      // Subscribe to admin rooms used by the control plane.
      this.socket?.emit("realtime.subscribe", { rooms: ["users", "permissions", "settings"] });
    });

    this.socket.on("disconnect", () => {
      this.setStatus("disconnected");
    });

    this.socket.onAny((event: string, payload: unknown) => {
      this.dispatch(event, payload);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
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
