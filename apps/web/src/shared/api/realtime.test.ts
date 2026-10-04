import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSocketOrigin } from "./realtime-client";
import {
  REALTIME_EVENT_CACHE_KEYS,
  REALTIME_ROOMS,
  REALTIME_SELF_EVENTS,
  REALTIME_STATUS_META,
  realtimeEventUserId,
  realtimeRoomsForPermissions,
  type RealtimeConnectionStatus,
} from "./realtime-events";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("resolveSocketOrigin", () => {
  it("prefers the public backend URL and strips the REST version suffix", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://api.example.com/v1");

    expect(resolveSocketOrigin()).toBe("https://api.example.com");
  });

  it("trims trailing slashes from the configured URL", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://api.example.com/");

    expect(resolveSocketOrigin()).toBe("https://api.example.com");
  });

  /**
   * The regression that made realtime look wired up while doing nothing: the
   * origin used to fall back to a loopback address, which in a browser on
   * another machine points at that machine instead of the backend.
   */
  it("mirrors the page host instead of assuming loopback", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "192.168.0.168",
      host: "192.168.0.168:3001",
    });

    expect(resolveSocketOrigin()).toBe("http://192.168.0.168:3000");
  });

  it("keeps the page protocol so a served app connects over TLS", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    vi.stubGlobal("location", {
      protocol: "https:",
      hostname: "admin.example.com",
      host: "admin.example.com",
    });

    expect(resolveSocketOrigin()).toBe("https://admin.example.com:3000");
  });
});

describe("realtimeRoomsForPermissions", () => {
  function hasAll(permissions: readonly string[]) {
    return (permission: string) => permissions.includes(permission);
  }

  it("grants the users room to a reader", () => {
    expect(realtimeRoomsForPermissions(hasAll(["users.read"]))).toEqual([
      "users",
    ]);
  });

  it("accepts manage as an alternative grant for the users room", () => {
    expect(realtimeRoomsForPermissions(hasAll(["users.manage"]))).toEqual([
      "users",
    ]);
  });

  it("returns every room a full administrator can enter", () => {
    const rooms = realtimeRoomsForPermissions(
      hasAll([
        "users.read",
        "permissions.read",
        "settings.read",
        "training.read",
      ]),
    );

    expect(rooms.sort()).toEqual(["permissions", "settings", "users"]);
  });

  it("returns nothing when the session has no realtime permissions", () => {
    expect(realtimeRoomsForPermissions(hasAll([]))).toEqual([]);
    expect(realtimeRoomsForPermissions(hasAll(["account.update"]))).toEqual([]);
  });

  it("mirrors the room names the gateway knows about", () => {
    expect(Object.keys(REALTIME_ROOMS).sort()).toEqual([
      "permissions",
      "settings",
      "users",
    ]);
  });
});

describe("REALTIME_EVENT_CACHE_KEYS", () => {
  /**
   * Cache roots are prefixes in React Query, so a single root per feature has to
   * cover the list and the detail queries of that feature.
   */
  it("refreshes every user query on any user event", () => {
    for (const event of [
      "user.created",
      "user.updated",
      "user.deleted",
      "user.invited",
    ]) {
      expect(REALTIME_EVENT_CACHE_KEYS[event]).toContainEqual(["users"]);
    }
  });

  it("refreshes settings when the control plane changes them", () => {
    expect(REALTIME_EVENT_CACHE_KEYS["settings.updated"]).toContainEqual([
      "settings",
    ]);
  });

  it("refreshes permissions and groups together", () => {
    expect(
      REALTIME_EVENT_CACHE_KEYS["permission-group.updated"],
    ).toEqual(expect.arrayContaining([["permissions"], ["permission-groups"]]));
  });

  it("never targets a cache root the app does not own", () => {
    const knownRoots = new Set([
      "users",
      "permissions",
      "permission-groups",
      "settings",
    ]);

    for (const keys of Object.values(REALTIME_EVENT_CACHE_KEYS)) {
      for (const key of keys) {
        expect(knownRoots).toContain(key[0]);
      }
    }
  });
});
describe("REALTIME_STATUS_META", () => {
  const STATUSES: RealtimeConnectionStatus[] = [
    "connected",
    "connecting",
    "disconnected",
  ];

  it("covers every connection state", () => {
    expect(Object.keys(REALTIME_STATUS_META).sort()).toEqual([...STATUSES].sort());
  });

  it("never shows the same state twice", () => {
    const labels = STATUSES.map((status) => REALTIME_STATUS_META[status].labelKey);
    const dots = STATUSES.map((status) => REALTIME_STATUS_META[status].dotClassName);

    expect(new Set(labels).size).toBe(STATUSES.length);
    expect(new Set(dots).size).toBe(STATUSES.length);
  });

  it("marks the live state apart from the others", () => {
    expect(REALTIME_STATUS_META.connected.dotClassName).toContain("emerald");
    expect(REALTIME_STATUS_META.disconnected.dotClassName).not.toContain("emerald");
  });
});

describe("realtimeEventUserId", () => {
  const USER_ID = "11111111-1111-4111-8111-111111111111";

  /** Shape the backend actually sends: the domain event inside an envelope. */
  const envelope = (data: unknown) => ({ event: "user.updated", data, meta: {} });

  it("reads the user out of the envelope", () => {
    expect(realtimeEventUserId(envelope({ userId: USER_ID }))).toBe(USER_ID);
  });

  it("accepts a bare payload", () => {
    expect(realtimeEventUserId({ userId: USER_ID })).toBe(USER_ID);
  });

  it("returns null for an event about nobody", () => {
    expect(realtimeEventUserId(envelope({ email: "a@b.c" }))).toBeNull();
  });

  it("returns null for anything that is not an object", () => {
    expect(realtimeEventUserId(null)).toBeNull();
    expect(realtimeEventUserId("user.updated")).toBeNull();
    expect(realtimeEventUserId(42)).toBeNull();
  });

  it("ignores a non-string id rather than comparing against it", () => {
    expect(realtimeEventUserId(envelope({ userId: 123 }))).toBeNull();
  });
});

describe("REALTIME_SELF_EVENTS", () => {
  it("only names events that are already handled", () => {
    for (const event of REALTIME_SELF_EVENTS) {
      expect(REALTIME_EVENT_CACHE_KEYS[event]).toBeDefined();
    }
  });

  it("covers the events that change the viewer's own name, avatar or rights", () => {
    expect([...REALTIME_SELF_EVENTS].sort()).toEqual([
      "user-permissions.updated",
      "user.updated",
    ]);
  });
});
