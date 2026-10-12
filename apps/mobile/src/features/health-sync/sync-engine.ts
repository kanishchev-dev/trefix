import type {
  DeviceActivity,
  DeviceProfileMetricsRequest,
  DeviceProvider,
  DeviceSyncBatchRequest,
  DeviceSyncType,
} from "@trefix/api-client";

import type { DeviceHealthSource, SyncCursor } from "./types";

/** Records per request; the backend refuses more. */
export const SYNC_BATCH_MAX = 50;
/** Profile metrics are pushed at most this often. */
export const PROFILE_METRICS_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the sync position and the last profile push are kept between runs. */
export interface SyncStateStore {
  getCursor(
    userId: string,
    provider: DeviceProvider,
  ): Promise<SyncCursor | null>;
  setCursor(
    userId: string,
    provider: DeviceProvider,
    cursor: SyncCursor | null,
  ): Promise<void>;
  getLastProfileSyncAt(
    userId: string,
    provider: DeviceProvider,
  ): Promise<number | null>;
  setLastProfileSyncAt(
    userId: string,
    provider: DeviceProvider,
    at: number,
  ): Promise<void>;
}

export interface SyncApi {
  postBatch(
    provider: DeviceProvider,
    batch: DeviceSyncBatchRequest,
  ): Promise<{ rejected: unknown[] }>;
  postProfileMetrics(
    provider: DeviceProvider,
    payload: DeviceProfileMetricsRequest,
  ): Promise<unknown>;
}

export type SyncDeps = {
  source: DeviceHealthSource;
  api: SyncApi;
  store: SyncStateStore;
  now: () => number;
  uuid: () => string;
};

export type SyncRequest = {
  userId: string;
  syncType: DeviceSyncType;
  historyDepthDays: number;
  profileSync: boolean;
  /** Stop reading new pages after this long; what was sent stays sent. */
  budgetMs?: number;
};

export type SyncResult = {
  status: "completed" | "partial" | "failed";
  batches: number;
  sentActivities: number;
  sentDeletions: number;
  rejected: number;
  profileSynced: boolean;
  error?: unknown;
};

type Item =
  | { kind: "activity"; activity: DeviceActivity }
  | { kind: "deleted"; id: string };

function toChunks(activities: DeviceActivity[], deleted: string[]): Item[][] {
  const items: Item[] = [
    ...activities.map((activity) => ({ kind: "activity" as const, activity })),
    ...deleted.map((id) => ({ kind: "deleted" as const, id })),
  ];
  const chunks: Item[][] = [];
  for (let index = 0; index < items.length; index += SYNC_BATCH_MAX) {
    chunks.push(items.slice(index, index + SYNC_BATCH_MAX));
  }
  return chunks;
}

/**
 * Reads changes page by page and pushes them in batches. The cursor moves
 * only after every batch of a page is accepted, so a failure never loses
 * records; the backend is idempotent, so resending is safe.
 */
export async function runSync(
  deps: SyncDeps,
  request: SyncRequest,
): Promise<SyncResult> {
  const { source, api, store, now } = deps;
  const provider = source.provider;
  const startedAt = now();
  const since = new Date(startedAt - request.historyDepthDays * DAY_MS);
  const syncId = deps.uuid();
  const result: SyncResult = {
    status: "completed",
    batches: 0,
    sentActivities: 0,
    sentDeletions: 0,
    rejected: 0,
    profileSynced: false,
  };

  let cursor = await store.getCursor(request.userId, provider);
  try {
    for (;;) {
      const page = await source.readWorkoutChanges(cursor, since);
      const seen = new Set<string>();
      const activities = page.activities.filter((activity) => {
        if (seen.has(activity.sourceActivityId)) return false;
        seen.add(activity.sourceActivityId);
        return true;
      });
      const deleted = [...new Set(page.deletedSourceActivityIds)].filter(
        (id) => !seen.has(id),
      );
      const chunks = toChunks(activities, deleted);
      // The closing batch of a session is sent even when empty, but only if the session sent something.
      if (chunks.length === 0 && !page.hasMore && result.batches > 0) {
        chunks.push([]);
      }

      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const isLast = !page.hasMore && index === chunks.length - 1;
        const response = await api.postBatch(provider, {
          syncId,
          batchIndex: result.batches,
          syncType: request.syncType,
          isLast,
          activities: chunk.flatMap((item) =>
            item.kind === "activity" ? [item.activity] : [],
          ),
          deletedSourceActivityIds: chunk.flatMap((item) =>
            item.kind === "deleted" ? [item.id] : [],
          ),
        });
        result.batches += 1;
        result.rejected += response.rejected.length;
        result.sentActivities += chunk.filter(
          (item) => item.kind === "activity",
        ).length;
        result.sentDeletions += chunk.filter(
          (item) => item.kind === "deleted",
        ).length;
      }

      cursor = page.nextCursor;
      await store.setCursor(request.userId, provider, cursor);

      if (!page.hasMore) break;
      if (
        request.budgetMs !== undefined &&
        now() - startedAt >= request.budgetMs
      ) {
        result.status = "partial";
        break;
      }
    }
  } catch (error) {
    return { ...result, status: "failed", error };
  }

  if (
    request.profileSync &&
    (request.budgetMs === undefined || now() - startedAt < request.budgetMs)
  ) {
    // A manual sync always re-reads the profile; automatic runs are throttled.
    result.profileSynced = await pushProfileMetrics(
      deps,
      request.userId,
      request.syncType === "manual",
    );
  }
  return result;
}

/** Weight, height and resting HR, at most every 12 hours unless forced. Failures are not fatal for the run. */
async function pushProfileMetrics(
  deps: SyncDeps,
  userId: string,
  force: boolean,
): Promise<boolean> {
  const { source, api, store, now } = deps;
  const last = await store.getLastProfileSyncAt(userId, source.provider);
  if (!force && last !== null && now() - last < PROFILE_METRICS_INTERVAL_MS) {
    return false;
  }
  try {
    const metrics = await source.readProfileMetrics(new Date(now()));
    if (
      !metrics.weight &&
      !metrics.height &&
      !metrics.restingHeartRate?.length
    ) {
      await store.setLastProfileSyncAt(userId, source.provider, now());
      return false;
    }
    await api.postProfileMetrics(source.provider, metrics);
    await store.setLastProfileSyncAt(userId, source.provider, now());
    return true;
  } catch {
    return false;
  }
}

const running = new Map<string, Promise<SyncResult>>();

/** Single-flight per provider: a trigger that fires during a run joins it. */
export function runSyncOnce(
  deps: SyncDeps,
  request: SyncRequest,
): Promise<SyncResult> {
  const key = `${request.userId}:${deps.source.provider}`;
  const current = running.get(key);
  if (current) return current;
  const promise = runSync(deps, request).finally(() => running.delete(key));
  running.set(key, promise);
  return promise;
}
