export interface RealtimeEventMeta {
  readonly emittedAt: string;
  readonly source?: string;
  readonly audience?: "all" | "user" | "users" | "room";
  readonly target?: string | string[];
}

export interface RealtimeEvent<TData = unknown> {
  readonly event: string;
  readonly data: TData;
  readonly meta?: RealtimeEventMeta;
}

export interface RealtimeErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type RealtimeConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type RealtimeEventHandler<TData = unknown> = (
  data: TData,
  meta?: RealtimeEventMeta,
) => void;

export type RealtimeAuthErrorListener = (error: RealtimeErrorPayload) => void;
