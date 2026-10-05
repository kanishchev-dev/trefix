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
  /** Session the token was issued for; the socket is bound to its lifetime. */
  sessionId?: string;
  /**
   * Set once the handshake middleware has authenticated the socket.
   *
   * Lets `handleConnection` tell "already done during the handshake" apart from
   * "never done", so it never authenticates (and never joins rooms) twice.
   */
  authResolved?: boolean;
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
  readonly sessionId: string;
}
