export const REALTIME_NAMESPACE = '/realtime';
export const REALTIME_INBOUND_AUTH_EVENT = 'realtime.auth';
export const REALTIME_INBOUND_SUBSCRIBE_EVENT = 'realtime.subscribe';
export const REALTIME_INBOUND_UNSUBSCRIBE_EVENT = 'realtime.unsubscribe';
export const REALTIME_INBOUND_COMMAND_EVENT = 'realtime.command';
export const REALTIME_INBOUND_PING_EVENT = 'realtime.ping';
export const REALTIME_OUTBOUND_EVENT = 'realtime.event';
export const REALTIME_OUTBOUND_ERROR_EVENT = 'realtime.error';
export const REALTIME_OUTBOUND_AUTHENTICATED_EVENT = 'realtime.authenticated';
export const REALTIME_OUTBOUND_PONG_EVENT = 'realtime.pong';
export const REALTIME_USER_ROOM_PREFIX = 'user:';
export const REALTIME_ROOM_PREFIX = 'room:';

/**
 * Sorted set of live sockets, keyed as `<userId>:<socketId>` with the
 * last-seen timestamp as the score.
 *
 * Presence therefore needs no cleanup job: a socket that dies without a clean
 * disconnect (crashed backend, killed laptop) simply stops being refreshed and
 * falls out of the window on its own, while several open tabs stay visible as
 * separate members.
 */
export const REALTIME_PRESENCE_REDIS_KEY = 'realtime:presence';

/** Event announcing that a user came online or went offline. */
export const REALTIME_PRESENCE_EVENT = 'user.presence.updated';

/**
 * How long a socket counts as online after its last heartbeat.
 *
 * Deliberately larger than the client heartbeat interval (25s) so a single
 * delayed or dropped ping does not make a working session blink offline.
 */
export const REALTIME_PRESENCE_TTL_MS = 75_000;
/**
 * One room per authenticated session.
 *
 * Joining it is what makes a revoked session effective: the socket is only
 * reachable through this room, so the listener can drop exactly the
 * connections that session opened, across every backend instance.
 */
export const REALTIME_SESSION_ROOM_PREFIX = 'session:';
