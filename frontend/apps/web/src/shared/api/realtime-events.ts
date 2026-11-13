/**
 * Contract between the backend realtime gateway and this admin app.
 *
 * Kept in a dedicated module so both ends of the wiring can be asserted:
 * `backend/src/modules/realtime/realtime-events.spec.ts` reads this file to prove
 * that every event the backend emits for these rooms is handled here, so a new
 * event cannot be published silently and go unnoticed.
 */

/** Inbound event names, mirroring `backend/src/modules/realtime/constants`. */
export const REALTIME_INBOUND = {
  subscribe: "realtime.subscribe",
  ping: "realtime.ping",
} as const;

/**
 * Connection state of the socket.
 *
 * Declared here rather than in the client so both the client and the status
 * indicator share one definition without an import cycle.
 */
export type RealtimeConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected";

/**
 * Rooms this app subscribes to, with the permissions that grant access to each.
 *
 * The gateway rejects the whole `realtime.subscribe` call when a single room is
 * forbidden, so asking for a room the session may not enter would silently cost
 * every other room too. Filtering here keeps the request valid for whatever the
 * current session is actually allowed to see.
 */
export const REALTIME_ROOMS: Readonly<Record<string, readonly string[]>> = {
  users: ["users.read", "users.manage"],
  permissions: ["permissions.read", "permissions.manage"],
  settings: ["settings.read"],
  analytics: ["analytics.read"],
};

/**
 * Rooms the given permission check grants access to.
 *
 * Takes a predicate rather than a permission list so callers pass their live
 * `hasPermission` without this module depending on the auth layer.
 */
export function realtimeRoomsForPermissions(
  hasPermission: (permission: string) => boolean,
): string[] {
  return Object.entries(REALTIME_ROOMS)
    .filter(([, permissions]) =>
      permissions.some((permission) => hasPermission(permission)),
    )
    .map(([room]) => room);
}

/**
 * How each connection state is presented.
 *
 * Pure data so the indicator stays a thin renderer, and so the mapping can be
 * asserted without mounting anything.
 */
export const REALTIME_STATUS_META: Readonly<
  Record<RealtimeConnectionStatus, { labelKey: string; dotClassName: string }>
> = {
  connected: {
    labelKey: "realtime.status.connected",
    dotClassName: "bg-success",
  },
  connecting: {
    labelKey: "realtime.status.connecting",
    dotClassName: "bg-warning",
  },
  disconnected: {
    labelKey: "realtime.status.disconnected",
    dotClassName: "bg-muted-foreground",
  },
};

/**
 * Backend event -> React Query cache roots that must be refreshed.
 *
 * Keeping the admin UI in sync with changes made in other sessions (or by the
 * backend control plane) is what makes those changes appear without a reload.
 * The roots are prefixes, so `["users"]` also covers `["users", "list", ...]`
 * and `["users", "detail", id]`.
 */
export const REALTIME_EVENT_CACHE_KEYS: Readonly<
  Record<string, readonly string[][]>
> = {
  "user.created": [["users"]],
  "user.invited": [["users"]],
  "user.updated": [["users"]],
  "user.deleted": [["users"]],
  // Presence is not user data, so it invalidates only the online-id set; a
  // refetch of the whole list here would be wasted work on every join/leave.
  "user.presence.updated": [["user-presence"]],
  "user-permissions.updated": [
    ["users"],
    ["permissions"],
    ["permission-groups"],
  ],
  "permission.created": [["permissions"], ["permission-groups"]],
  "permission.updated": [["permissions"], ["permission-groups"]],
  "permission.deleted": [["permissions"], ["permission-groups"]],
  "permission-group.created": [
    ["permissions"],
    ["permission-groups"],
    ["settings"],
  ],
  "permission-group.updated": [
    ["permissions"],
    ["permission-groups"],
    ["settings"],
  ],
  "permission-group.deleted": [
    ["permissions"],
    ["permission-groups"],
    ["settings"],
  ],
  "settings.updated": [["settings"]],
  // Throttled on the backend; only the dashboard blocks on screen refetch.
  "analytics.updated": [["analytics"]],
};
/**
 * Events that can change the viewer's own record.
 *
 * The signed-in user is not a react-query entry: the sidebar name, the avatar
 * and every permission gate read it from the auth context. Invalidating the
 * `["users"]` cache therefore updates the tables and the detail pages while the
 * header keeps the old name until a reload — so these events need the session
 * refreshed separately.
 */
export const REALTIME_SELF_EVENTS = [
  "user.updated",
  "user-permissions.updated",
] as const;

/**
 * Which user an event is about.
 *
 * Reads through the realtime envelope (`{ event, data, meta }`) and tolerates a
 * bare payload, so a shape change on one side cannot silently turn into "this
 * event is about nobody" and quietly disable the refresh.
 */
export function realtimeEventUserId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const envelope = payload as { data?: unknown; userId?: unknown };

  for (const candidate of [envelope.data, envelope]) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }

    const userId = (candidate as { userId?: unknown }).userId;
    if (typeof userId === "string" && userId.length > 0) {
      return userId;
    }
  }

  return null;
}

/**
 * Presence change carried by `user.presence.updated`.
 *
 * Returned as null unless both the id and the flag are actually present: a
 * half-parsed event must not be read as "the user went offline", which would
 * silently blank out a correct indicator.
 */
export function realtimeEventPresence(payload: unknown): {
  userId: string;
  online: boolean;
} | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const envelope = payload as {
    data?: unknown;
    userId?: unknown;
    online?: unknown;
  };

  for (const candidate of [envelope.data, envelope]) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }

    const { userId, online } = candidate as {
      userId?: unknown;
      online?: unknown;
    };

    if (
      typeof userId === "string" &&
      userId.length > 0 &&
      typeof online === "boolean"
    ) {
      return { userId, online };
    }
  }

  return null;
}
