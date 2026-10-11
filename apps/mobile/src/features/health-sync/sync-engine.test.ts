import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DeviceActivity,
  DeviceProvider,
  DeviceSyncBatchRequest,
} from "@workspace/api-client";

import {
  PROFILE_METRICS_INTERVAL_MS,
  runSync,
  runSyncOnce,
  type SyncDeps,
  type SyncStateStore,
} from "./sync-engine";
import type { DeviceHealthSource, WorkoutChangesPage } from "./types";

const NOW = Date.parse("2026-10-09T12:00:00Z");

const activity = (id: string): DeviceActivity => ({
  sourceActivityId: id,
  type: "run",
  startedAt: "2026-10-08T05:00:00.000Z",
  endedAt: "2026-10-08T05:50:00.000Z",
  durationSec: 3000,
  distanceMeters: 10000,
});

function memoryStore(): SyncStateStore & {
  cursors: Map<string, string | null>;
  profileAt: Map<string, number>;
} {
  const cursors = new Map<string, string | null>();
  const profileAt = new Map<string, number>();
  const key = (userId: string, provider: DeviceProvider) =>
    `${userId}:${provider}`;
  return {
    cursors,
    profileAt,
    getCursor: async (userId, provider) =>
      cursors.get(key(userId, provider)) ?? null,
    setCursor: async (userId, provider, cursor) =>
      void cursors.set(key(userId, provider), cursor),
    getLastProfileSyncAt: async (userId, provider) =>
      profileAt.get(key(userId, provider)) ?? null,
    setLastProfileSyncAt: async (userId, provider, at) =>
      void profileAt.set(key(userId, provider), at),
  };
}

function sourceWith(
  pages: WorkoutChangesPage[],
): DeviceHealthSource & { calls: Array<string | null> } {
  const calls: Array<string | null> = [];
  let index = 0;
  return {
    provider: "apple_health",
    calls,
    getAvailability: async () => "available",
    requestPermissions: async () => [],
    getGrantedScopes: async () => [],
    readWorkoutChanges: async (cursor) => {
      calls.push(cursor);
      return pages[Math.min(index++, pages.length - 1)];
    },
    readProfileMetrics: async () => ({
      weight: { valueKg: 70, measuredAt: "2026-10-09T06:00:00.000Z" },
    }),
    openSystemSettings: async () => undefined,
  };
}

describe("runSync", () => {
  let store: ReturnType<typeof memoryStore>;
  let batches: DeviceSyncBatchRequest[];
  let deps: SyncDeps;
  const request = {
    userId: "user-1",
    syncType: "initial" as const,
    historyDepthDays: 180,
    profileSync: false,
  };

  beforeEach(() => {
    store = memoryStore();
    batches = [];
    deps = {
      source: sourceWith([]),
      api: {
        postBatch: vi.fn(async (_provider, batch: DeviceSyncBatchRequest) => {
          batches.push(batch);
          return { rejected: [] };
        }),
        postProfileMetrics: vi.fn(async () => ({})),
      },
      store,
      now: () => NOW,
      uuid: () => "sync-1",
    };
  });

  it("splits pages into batches of 50 and marks only the very last one", async () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      activity(`a${index}`),
    );
    deps.source = sourceWith([
      {
        activities: many,
        deletedSourceActivityIds: [],
        nextCursor: "c1",
        hasMore: true,
      },
      {
        activities: [activity("b1")],
        deletedSourceActivityIds: ["gone"],
        nextCursor: "c2",
        hasMore: false,
      },
    ]);

    const result = await runSync(deps, request);

    expect(result).toMatchObject({
      status: "completed",
      batches: 3,
      sentActivities: 61,
      sentDeletions: 1,
    });
    expect(
      batches.map((batch) => [
        batch.batchIndex,
        batch.activities.length,
        batch.isLast,
      ]),
    ).toEqual([
      [0, 50, false],
      [1, 10, false],
      [2, 1, true],
    ]);
    expect(batches[2].deletedSourceActivityIds).toEqual(["gone"]);
    expect(new Set(batches.map((batch) => batch.syncId))).toEqual(
      new Set(["sync-1"]),
    );
    expect(store.cursors.get("user-1:apple_health")).toBe("c2");
  });

  it("closes a session with an empty last batch only when something was sent", async () => {
    deps.source = sourceWith([
      {
        activities: [activity("a")],
        deletedSourceActivityIds: [],
        nextCursor: "c1",
        hasMore: true,
      },
      {
        activities: [],
        deletedSourceActivityIds: [],
        nextCursor: "c2",
        hasMore: false,
      },
    ]);
    await runSync(deps, request);
    expect(
      batches.map((batch) => [batch.activities.length, batch.isLast]),
    ).toEqual([
      [1, false],
      [0, true],
    ]);

    batches = [];
    deps.source = sourceWith([
      {
        activities: [],
        deletedSourceActivityIds: [],
        nextCursor: "c3",
        hasMore: false,
      },
    ]);
    await runSync(deps, request);
    expect(batches).toEqual([]);
    expect(store.cursors.get("user-1:apple_health")).toBe("c3");
  });

  it("keeps the cursor when the server does not accept a batch", async () => {
    await store.setCursor("user-1", "apple_health", "c0");
    deps.source = sourceWith([
      {
        activities: [activity("a")],
        deletedSourceActivityIds: [],
        nextCursor: "c1",
        hasMore: false,
      },
    ]);
    deps.api.postBatch = vi.fn(async () => {
      throw new Error("offline");
    });

    const result = await runSync(deps, request);

    expect(result.status).toBe("failed");
    expect(store.cursors.get("user-1:apple_health")).toBe("c0");
  });

  it("starts from the stored cursor and drops duplicates inside a page", async () => {
    await store.setCursor("user-1", "apple_health", "c0");
    const source = sourceWith([
      {
        activities: [activity("a"), activity("a")],
        deletedSourceActivityIds: ["a", "x", "x"],
        nextCursor: "c1",
        hasMore: false,
      },
    ]);
    deps.source = source;

    await runSync(deps, request);

    expect(source.calls).toEqual(["c0"]);
    expect(batches[0].activities).toHaveLength(1);
    expect(batches[0].deletedSourceActivityIds).toEqual(["x"]);
  });

  it("stops after the time budget and reports a partial run", async () => {
    let clock = NOW;
    deps.now = () => clock;
    deps.source = sourceWith([
      {
        activities: [activity("a")],
        deletedSourceActivityIds: [],
        nextCursor: "c1",
        hasMore: true,
      },
    ]);
    deps.api.postBatch = vi.fn(async () => {
      clock += 30_000;
      return { rejected: [] };
    });

    const result = await runSync(deps, { ...request, budgetMs: 20_000 });

    expect(result.status).toBe("partial");
    expect(deps.api.postBatch).toHaveBeenCalledTimes(1);
    expect(store.cursors.get("user-1:apple_health")).toBe("c1");
  });

  it("pushes profile metrics at most every 12 hours", async () => {
    deps.source = sourceWith([
      {
        activities: [],
        deletedSourceActivityIds: [],
        nextCursor: "c1",
        hasMore: false,
      },
    ]);

    const first = await runSync(deps, { ...request, profileSync: true });
    const second = await runSync(deps, { ...request, profileSync: true });
    deps.now = () => NOW + PROFILE_METRICS_INTERVAL_MS + 1;
    const third = await runSync(deps, { ...request, profileSync: true });

    expect([
      first.profileSynced,
      second.profileSynced,
      third.profileSynced,
    ]).toEqual([true, false, true]);
    expect(deps.api.postProfileMetrics).toHaveBeenCalledTimes(2);
  });

  it("does not push profile metrics when the setting is off", async () => {
    deps.source = sourceWith([
      {
        activities: [],
        deletedSourceActivityIds: [],
        nextCursor: "c1",
        hasMore: false,
      },
    ]);
    await runSync(deps, request);
    expect(deps.api.postProfileMetrics).not.toHaveBeenCalled();
  });
});

describe("runSyncOnce", () => {
  it("joins a run that is already in progress", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = sourceWith([
      {
        activities: [activity("a")],
        deletedSourceActivityIds: [],
        nextCursor: "c1",
        hasMore: false,
      },
    ]);
    const postBatch = vi.fn(async () => {
      await gate;
      return { rejected: [] };
    });
    const deps: SyncDeps = {
      source,
      api: { postBatch, postProfileMetrics: vi.fn() },
      store: memoryStore(),
      now: () => NOW,
      uuid: () => "sync-1",
    };
    const request = {
      userId: "user-1",
      syncType: "foreground" as const,
      historyDepthDays: 180,
      profileSync: false,
    };

    const first = runSyncOnce(deps, request);
    const second = runSyncOnce(deps, request);
    release();

    expect(await first).toBe(await second);
    expect(source.calls).toHaveLength(1);
  });
});
