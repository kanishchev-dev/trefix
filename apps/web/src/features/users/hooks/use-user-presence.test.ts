import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { realtimeEventPresence } from "@/shared/api/realtime-events";
import { userPresenceKeys } from "./use-user-presence";

describe("userPresenceKeys", () => {
  /**
   * The list query and the detail page must not overwrite one another: the table
   * asks about ten users, the card about one, and both answers are cached under
   * this root.
   */
  it("separates different sets of users", () => {
    const list = userPresenceKeys.list(["a", "b"]);
    const detail = userPresenceKeys.list(["a"]);

    expect(list).not.toEqual(detail);
    expect(list[0]).toBe(detail[0]);
  });

  it("is stable regardless of the order the ids arrived in", () => {
    expect(userPresenceKeys.list(["b", "a"])).toEqual(userPresenceKeys.list(["a", "b"]));
  });
});

describe("realtimeEventPresence", () => {
  it("reads the change out of the realtime envelope", () => {
    const payload = {
      event: "user.presence.updated",
      data: { userId: "user-1", online: true },
      meta: { emittedAt: "2024-01-01T00:00:00.000Z" },
    };

    expect(realtimeEventPresence(payload)).toEqual({ userId: "user-1", online: true });
  });

  it("tolerates a bare payload", () => {
    expect(realtimeEventPresence({ userId: "user-1", online: false })).toEqual({
      userId: "user-1",
      online: false,
    });
  });

  /**
   * A half-parsed event must not be read as "went offline": that would blank
   * out an indicator the user is still connected to.
   */
  it("rejects an event without an online flag", () => {
    expect(realtimeEventPresence({ data: { userId: "user-1" } })).toBeNull();
  });

  it("rejects an event without a user id", () => {
    expect(realtimeEventPresence({ data: { online: true } })).toBeNull();
  });

  it("rejects anything that is not an object", () => {
    expect(realtimeEventPresence(null)).toBeNull();
    expect(realtimeEventPresence("user.presence.updated")).toBeNull();
  });
});

describe("presence cache patching", () => {
  it("keeps a cached online set consistent with an event", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(userPresenceKeys.list(["user-1"]), new Set(["user-1"]));

    const patch = (online: boolean) => {
      queryClient.setQueriesData<Set<string>>(
        { queryKey: userPresenceKeys.all },
        (cached) => {
          if (!cached) return cached;
          const next = new Set(cached);
          if (online) next.add("user-2");
          else next.delete("user-2");
          return next;
        },
      );
    };

    patch(true);
    expect(queryClient.getQueryData<Set<string>>(userPresenceKeys.list(["user-1"]))?.has("user-2")).toBe(true);

    patch(false);
    expect(queryClient.getQueryData<Set<string>>(userPresenceKeys.list(["user-1"]))?.has("user-2")).toBe(false);
  });
});