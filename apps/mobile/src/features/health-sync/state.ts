import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { DeviceProvider } from "@workspace/api-client";

import type { SyncStateStore } from "./sync-engine";
import type { SyncCursor } from "./types";

const ACTIVE_KEY = "health-sync:active";
const DEVICE_ID_KEY = "health-sync:device-id";
const PREFIX = "health-sync:";

/**
 * The connection this device syncs, kept locally so a background wake can
 * sync without UI. Written on connect, removed on disconnect and logout.
 */
export type ActiveHealthSync = {
  userId: string;
  provider: DeviceProvider;
  historyDepthDays: number;
  profileSync: boolean;
  background: boolean;
};

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function getActiveHealthSync(): Promise<ActiveHealthSync | null> {
  return readJson<ActiveHealthSync>(ACTIVE_KEY);
}

export async function setActiveHealthSync(
  value: ActiveHealthSync,
): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(value));
}

export async function updateActiveHealthSync(
  patch: Partial<ActiveHealthSync>,
): Promise<void> {
  const current = await getActiveHealthSync();
  if (current) await setActiveHealthSync({ ...current, ...patch });
}

/** Forgets the connection and every cursor of `userId` (all users when omitted). */
export async function clearHealthSyncState(userId?: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter(
      (key) =>
        key === ACTIVE_KEY ||
        (key.startsWith(PREFIX) &&
          key !== DEVICE_ID_KEY &&
          (!userId || key.startsWith(`${PREFIX}${userId}:`))),
    );
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
  } catch {
    // Nothing to clean or storage unavailable: the next connect starts over anyway.
  }
}

/** Installation id sent with the connection; survives logout. */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY).catch(() => null);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, created).catch(() => undefined);
  return created;
}

const cursorKey = (userId: string, provider: DeviceProvider): string =>
  `${PREFIX}${userId}:${provider}:cursor`;
const profileKey = (userId: string, provider: DeviceProvider): string =>
  `${PREFIX}${userId}:${provider}:profile-at`;

/** Cursors are not secrets: losing one only re-reads history, which the backend deduplicates. */
export const asyncStorageSyncStore: SyncStateStore = {
  async getCursor(userId, provider): Promise<SyncCursor | null> {
    return AsyncStorage.getItem(cursorKey(userId, provider)).catch(() => null);
  },
  async setCursor(userId, provider, cursor): Promise<void> {
    if (cursor === null) {
      await AsyncStorage.removeItem(cursorKey(userId, provider));
    } else {
      await AsyncStorage.setItem(cursorKey(userId, provider), cursor);
    }
  },
  async getLastProfileSyncAt(userId, provider): Promise<number | null> {
    const raw = await AsyncStorage.getItem(profileKey(userId, provider)).catch(
      () => null,
    );
    return raw ? Number(raw) : null;
  },
  async setLastProfileSyncAt(userId, provider, at): Promise<void> {
    await AsyncStorage.setItem(profileKey(userId, provider), String(at));
  },
};
