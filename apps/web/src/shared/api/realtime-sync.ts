/**
 * Writes realtime events straight into the React Query cache.
 *
 * Invalidating alone would be correct but visibly late: the event already says
 * which record changed and carries its new values, so waiting for the refetch
 * to travel to the server and back leaves the UI showing stale rows until the
 * round trip finishes. Merging first paints the change immediately, and the
 * background refetch that follows still corrects anything the event did not
 * carry (roles, counters, server-side defaults).
 *
 * Every merge is field-by-field and only touches keys that already exist on the
 * cached record, so a payload can never invent a field the API would not return.
 */

import type { QueryClient } from "@tanstack/react-query";
import type {
  AdminUser,
  AdminUserDetail,
  PaginatedResponse,
} from "@trefix/api-client";

/** Fields `user.updated` can carry; mirrors `UserUpdatedEvent` on the backend. */
const USER_EVENT_FIELDS = [
  "email",
  "firstName",
  "lastName",
  "avatarUrl",
] as const satisfies readonly (keyof AdminUser)[];

type UserEventPayload = {
  userId?: unknown;
} & Partial<Pick<AdminUser, (typeof USER_EVENT_FIELDS)[number]>>;

const USER_LIST_KEY: readonly unknown[] = ["users", "list"];

/**
 * Unwraps the realtime envelope (`{ event, data, meta }`).
 *
 * Tolerates a bare payload so a shape change on one side degrades into "nothing
 * merged, refetch only" instead of throwing inside a socket listener.
 */
export function realtimeEventData(
  payload: unknown,
): Record<string, unknown> | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const envelope = payload as { data?: unknown };

  return typeof envelope.data === "object" && envelope.data !== null
    ? (envelope.data as Record<string, unknown>)
    : (payload as Record<string, unknown>);
}

/** Copies the event's fields onto a cached record, skipping absent ones. */
function mergeUserRecord<T extends AdminUser>(
  cached: T,
  payload: UserEventPayload,
): T {
  const patch: Partial<T> = {};

  for (const field of USER_EVENT_FIELDS) {
    if (payload[field] !== undefined) {
      (patch as Record<string, unknown>)[field] = payload[field];
    }
  }

  return Object.keys(patch).length > 0 ? { ...cached, ...patch } : cached;
}

/**
 * Applies a `user.updated` event to the detail page and to every cached list.
 *
 * Returns whether anything was actually merged, so the caller can skip the
 * redundant refetch when the record is not on screen at all.
 */
export function mergeUpdatedUser(
  queryClient: QueryClient,
  payload: unknown,
): boolean {
  const data = realtimeEventData(payload) as UserEventPayload | null;

  if (!data || typeof data.userId !== "string" || data.userId.length === 0) {
    return false;
  }

  let merged = false;

  queryClient.setQueryData<AdminUserDetail>(
    ["users", "detail", data.userId],
    (cached) => {
      if (!cached) {
        return cached;
      }

      merged = true;
      return mergeUserRecord(cached, data);
    },
  );

  for (const [queryKey, cached] of queryClient.getQueriesData<
    PaginatedResponse<AdminUser>
  >({ queryKey: USER_LIST_KEY })) {
    if (!cached || !Array.isArray(cached.data)) {
      continue;
    }

    if (!cached.data.some((user) => user.id === data.userId)) {
      continue;
    }

    queryClient.setQueryData<PaginatedResponse<AdminUser>>(queryKey, {
      ...cached,
      data: cached.data.map((user) =>
        user.id === data.userId ? mergeUserRecord(user, data) : user,
      ),
    });
    merged = true;
  }

  return merged;
}

type RealtimeCacheMerge = (
  queryClient: QueryClient,
  payload: unknown,
) => boolean;

const CACHE_MERGES: Readonly<Record<string, RealtimeCacheMerge>> = {
  "user.updated": mergeUpdatedUser,
};

/**
 * Merges an event into the cache when it knows how.
 *
 * Returns `false` for events with no merge rule, which leaves the caller free to
 * rely on invalidation alone for those.
 */
export function applyRealtimeEventToCache(
  queryClient: QueryClient,
  event: string,
  payload: unknown,
): boolean {
  const merge = CACHE_MERGES[event];

  return merge ? merge(queryClient, payload) : false;
}
