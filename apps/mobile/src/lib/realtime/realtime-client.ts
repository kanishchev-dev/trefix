import { io, Socket } from "socket.io-client";
import { AppState, type AppStateStatus } from "react-native";

import { BACKEND_BASE_URL } from "../backend-url";
import {
  type RealtimeAuthErrorListener,
  type RealtimeConnectionStatus,
  type RealtimeErrorPayload,
  type RealtimeEvent,
  type RealtimeEventHandler,
} from "./types";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:3000";

function resolveSocketOrigin(): string {
  const envUrl = BACKEND_BASE_URL || DEFAULT_BACKEND_URL;

  // Remove trailing `/v1` or `/v1/` REST versioning path to get WS base origin
  return envUrl.replace(/\/v1\/?$/, "");
}

const AUTH_ERROR_CODES = new Set([
  "WS_AUTH_MISSING_TOKEN",
  "WS_AUTH_INVALID_TOKEN",
  "WS_NOT_AUTHENTICATED",
  "WS_AUTH_FAILED",
]);

export class RealtimeClient {
  private socket: Socket | null = null;
  private status: RealtimeConnectionStatus = "disconnected";
  private token: string | null = null;
  private eventHandlers = new Map<string, Set<RealtimeEventHandler>>();
  private statusListeners = new Set<(status: RealtimeConnectionStatus) => void>();
  private authErrorListeners = new Set<RealtimeAuthErrorListener>();
  private appStateSubscription: { remove: () => void } | null = null;
  private backgroundDisconnectTimer: ReturnType<typeof setTimeout> | null = null;

  public getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === "connected";
  }

  public connect(token: string): void {
    if (this.socket && this.token === token && this.status === "connected") {
      return;
    }

    this.disconnect();
    this.token = token;
    this.setStatus("connecting");

    const origin = resolveSocketOrigin();
    const namespaceUrl = `${origin}/realtime`;

    console.log(`[RealtimeClient] Connecting to WebSocket: ${namespaceUrl}`);

    this.socket = io(namespaceUrl, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.setupSocketListeners();
    this.setupAppStateListener();
  }

  public disconnect(): void {
    if (this.backgroundDisconnectTimer) {
      clearTimeout(this.backgroundDisconnectTimer);
      this.backgroundDisconnectTimer = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.socket) {
      console.log("[RealtimeClient] Disconnecting socket...");
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.token = null;
    this.setStatus("disconnected");
  }

  public onStatusChange(
    listener: (status: RealtimeConnectionStatus) => void,
  ): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onAuthError(listener: RealtimeAuthErrorListener): () => void {
    this.authErrorListeners.add(listener);
    return () => {
      this.authErrorListeners.delete(listener);
    };
  }

  public on<T = unknown>(event: string, handler: RealtimeEventHandler<T>): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event)!;
    handlers.add(handler as RealtimeEventHandler);

    return () => {
      handlers.delete(handler as RealtimeEventHandler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    };
  }

  public subscribeRooms(rooms: string[]): void {
    if (this.socket && this.status === "connected" && rooms.length > 0) {
      this.socket.emit("realtime.subscribe", { rooms });
    }
  }

  public unsubscribeRooms(rooms: string[]): void {
    if (this.socket && this.status === "connected" && rooms.length > 0) {
      this.socket.emit("realtime.unsubscribe", { rooms });
    }
  }

  private setStatus(nextStatus: RealtimeConnectionStatus): void {
    if (this.status === nextStatus) return;
    this.status = nextStatus;
    console.log(`[RealtimeClient] Connection status changed to: ${nextStatus}`);
    this.statusListeners.forEach((listener) => listener(nextStatus));
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("[RealtimeClient] WebSocket connected successfully");
      this.setStatus("connected");
    });

    this.socket.on("disconnect", (reason: string) => {
      console.log(`[RealtimeClient] Socket disconnected. Reason: ${reason}`);
      this.setStatus("disconnected");
    });

    this.socket.on("connect_error", (error: Error) => {
      console.warn("[RealtimeClient] Socket connect error:", error.message);
      this.setStatus("error");
    });

    this.socket.on("realtime.authenticated", (payload: unknown) => {
      console.log("[RealtimeClient] Authenticated event received from server:", payload);
      this.setStatus("connected");
    });

    this.socket.on("realtime.error", (errorPayload: RealtimeErrorPayload) => {
      console.warn("[RealtimeClient] Realtime error from server:", errorPayload);
      if (errorPayload?.code && AUTH_ERROR_CODES.has(errorPayload.code)) {
        console.log(
          `[RealtimeClient] Authentication error detected (${errorPayload.code}). Notifying auth listeners...`,
        );
        this.authErrorListeners.forEach((listener) => listener(errorPayload));
      }
    });

    // Catch-all listener using socket.io onAny to dispatch all incoming events
    this.socket.onAny((eventName: string, payload: unknown) => {
      if (eventName.startsWith("connect") || eventName.startsWith("disconnect")) {
        return;
      }

      this.dispatchEvent(eventName, payload);
    });
  }

  private dispatchEvent(eventName: string, rawPayload: unknown): void {
    let resolvedEventName = eventName;
    let data: unknown = rawPayload;
    let meta: RealtimeEvent["meta"] = undefined;

    // If payload is wrapped in RealtimeEvent envelope `{ event, data, meta }`
    if (
      typeof rawPayload === "object" &&
      rawPayload !== null &&
      "event" in rawPayload &&
      "data" in rawPayload
    ) {
      const envelope = rawPayload as RealtimeEvent;
      resolvedEventName = envelope.event || eventName;
      data = envelope.data;
      meta = envelope.meta;
    }

    console.log(`[RealtimeClient] Dispatching event "${resolvedEventName}"`);

    const handlers = this.eventHandlers.get(resolvedEventName);
    if (handlers && handlers.size > 0) {
      handlers.forEach((handler) => {
        try {
          handler(data, meta);
        } catch (error) {
          console.error(
            `[RealtimeClient] Error in handler for event "${resolvedEventName}":`,
            error,
          );
        }
      });
    }
  }

  private setupAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        // Delay disconnect slightly (15s) in case of brief app switches
        this.backgroundDisconnectTimer = setTimeout(() => {
          if (this.socket && this.status === "connected") {
            console.log("[RealtimeClient] App in background, pausing WebSocket...");
            this.socket.disconnect();
            this.setStatus("disconnected");
          }
        }, 15000);
      } else if (nextAppState === "active") {
        if (this.backgroundDisconnectTimer) {
          clearTimeout(this.backgroundDisconnectTimer);
          this.backgroundDisconnectTimer = null;
        }

        if (this.token && (!this.socket || !this.socket.connected)) {
          console.log("[RealtimeClient] App returned to foreground, reconnecting WebSocket...");
          this.connect(this.token);
        }
      }
    };

    this.appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
  }
}
