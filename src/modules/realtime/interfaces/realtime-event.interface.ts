export interface RealtimeEventMeta {
  readonly emittedAt: string;
  readonly source?: string;
  readonly audience?: 'all' | 'user' | 'users' | 'room';
  readonly target?: string | string[];
}

export interface RealtimeEvent<TData = unknown> {
  readonly event: string;
  readonly data: TData;
  readonly meta?: RealtimeEventMeta;
}

export interface RealtimeUserContext {
  readonly id: string;
  readonly email?: string;
  readonly permissions?: string[];
}

export interface RealtimeSocketData {
  user?: RealtimeUserContext;
  rooms?: string[];
}

export interface RealtimeErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface RealtimeSubscriptionPayload {
  readonly rooms: string[];
}

export interface RealtimeCommandPayload<TData = unknown> {
  readonly event: string;
  readonly data?: TData;
}

export interface RealtimeAuthPayload {
  readonly token: string;
  readonly rooms?: string[];
}

export interface RealtimeAuthResult {
  readonly user: RealtimeUserContext;
  readonly rooms: string[];
}
