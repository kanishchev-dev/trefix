import * as Crypto from "expo-crypto";
import { ApiClientError, type DeviceSyncType } from "@trefix/api-client";

import { loadAuthSession } from "../../lib/auth-session";
import {
  postDeviceProfileMetrics,
  postDeviceSyncBatch,
} from "../../lib/integrations-api";
import { disableHealthBackground } from "./background-control";
import { getHealthSource } from "./sources";
import {
  asyncStorageSyncStore,
  clearHealthSyncState,
  getActiveHealthSync,
} from "./state";
import { runSyncOnce, type SyncResult } from "./sync-engine";

/** Time a background wake may spend; iOS gives roughly half a minute. */
export const BACKGROUND_BUDGET_MS: Record<"ios" | "android", number> = {
  ios: 20_000,
  android: 60_000,
};

/**
 * Syncs the connection stored on this device. Returns null when there is
 * nothing to sync (not connected, logged out or another user's connection).
 */
export async function syncHealthNow(
  syncType: DeviceSyncType,
  budgetMs?: number,
): Promise<SyncResult | null> {
  // Nothing is connected on most devices: decide that before touching any native module.
  const active = await getActiveHealthSync();
  if (!active) return null;
  const session = await loadAuthSession();
  if (!session || session.user.id !== active.userId) return null;
  const source = getHealthSource();
  if (!source || source.provider !== active.provider) return null;
  // Types added in an app update need their own grant; only a user-started sync may show the dialog.
  if (syncType === "manual" && source.ensureReadAccess) {
    await source.ensureReadAccess().catch(() => undefined);
  }
  const result = await runSyncOnce(
    {
      source,
      api: {
        postBatch: postDeviceSyncBatch,
        postProfileMetrics: postDeviceProfileMetrics,
      },
      store: asyncStorageSyncStore,
      now: () => Date.now(),
      uuid: () => Crypto.randomUUID(),
    },
    {
      userId: active.userId,
      syncType,
      historyDepthDays: active.historyDepthDays,
      profileSync: active.profileSync,
      budgetMs,
    },
  );
  // Disconnected elsewhere (another device, consent revoked): stop syncing from here.
  if (
    result.status === "failed" &&
    result.error instanceof ApiClientError &&
    (result.error.code === "INTEGRATION_NOT_CONNECTED" ||
      result.error.code === "PROVIDER_NOT_SUPPORTED")
  ) {
    await disableHealthBackground();
    await clearHealthSyncState(active.userId);
  }
  return result;
}
