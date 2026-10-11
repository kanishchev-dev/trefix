import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { DeviceProvider, IntegrationItem } from "@workspace/api-client";

import { trackEvent } from "../../lib/analytics";
import { loadAuthSession } from "../../lib/auth-session";
import {
  getConsents,
  giveConsent,
  HEALTH_CONSENT_VERSION,
} from "../../lib/consents-api";
import {
  connectDeviceProvider,
  disconnectDeviceProvider,
  getDeviceSyncStatus,
  updateDeviceConnection,
} from "../../lib/integrations-api";
import { useRealtimeEvent } from "../../lib/realtime";
import { useIntegrations } from "../main/hooks/use-integrations";
import {
  disableHealthBackground,
  enableHealthBackground,
} from "./background-control";
import { syncHealthNow } from "./runner";
import { getHealthSource, platformHealthProvider } from "./sources";
import {
  asyncStorageSyncStore,
  clearHealthSyncState,
  getActiveHealthSync,
  getDeviceId,
  setActiveHealthSync,
  updateActiveHealthSync,
} from "./state";
import { queryKeys } from "../../shared/lib/query-keys";

export const HEALTH_HISTORY_DEPTH_DAYS = 180;
const FOREGROUND_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/** Health Connect: the user closed the dialog without granting workouts. */
export class HealthPermissionDeniedError extends Error {
  constructor() {
    super("Health permissions were not granted");
    this.name = "HealthPermissionDeniedError";
  }
}

/** Everything that changes when runs arrive. */
export function invalidateAfterHealthSync(queryClient: QueryClient): void {
  for (const queryKey of [
    ["integrations"],
    ["workouts"],
    ["plan"],
    ["plans"],
    ["progress"],
    ["athlete"],
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

async function currentUserId(): Promise<string> {
  const session = await loadAuthSession();
  if (!session) throw new Error("Not signed in");
  return session.user.id;
}

/** The native health store, or an error the UI reports as "couldn't connect". */
function requireSource() {
  const source = getHealthSource();
  if (!source) throw new Error("Health store is not available in this build");
  return source;
}

function requireProvider(): DeviceProvider {
  const provider = platformHealthProvider();
  if (!provider) throw new Error("No health store on this platform");
  return provider;
}

export function useHealthProvider(): DeviceProvider | null {
  return platformHealthProvider();
}

export function useHealthAvailability() {
  const source = getHealthSource();
  return useQuery({
    queryKey: queryKeys.health.availability(),
    queryFn: () => source!.getAvailability(),
    enabled: !!source,
    staleTime: 0,
  });
}

/** The provider's item from `GET /integrations`. */
export function useHealthIntegration(): {
  item: IntegrationItem | null;
  isLoading: boolean;
} {
  const provider = platformHealthProvider();
  const { data, isLoading } = useIntegrations();
  return {
    item: data?.items.find((entry) => entry.provider === provider) ?? null,
    isLoading,
  };
}

export function useHealthConsent() {
  const query = useQuery({
    queryKey: queryKeys.consents.all,
    queryFn: getConsents,
  });
  const current = query.data?.items.find(
    (consent) =>
      consent.type === "health_data" &&
      consent.isCurrent &&
      consent.version === HEALTH_CONSENT_VERSION,
  );
  return { hasConsent: !!current, isLoading: query.isLoading };
}

export function useGiveHealthConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      giveConsent("health_data", HEALTH_CONSENT_VERSION, {
        platform: Platform.OS === "ios" ? "ios" : "android",
      }),
    onSuccess: () => {
      trackEvent("health_consent_accepted");
      void queryClient.invalidateQueries({ queryKey: queryKeys.consents.all });
    },
  });
}

/** System dialog → backend connection → background delivery → initial sync (not awaited). */
export function useConnectHealth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<IntegrationItem> => {
      const provider = requireProvider();
      const source = requireSource();
      const userId = await currentUserId();
      const scopes = await source.requestPermissions({
        history: true,
        background: true,
      });
      trackEvent("health_permissions_requested", {
        granted_count: scopes.length,
      });
      if (!scopes.includes("workouts")) {
        throw new HealthPermissionDeniedError();
      }
      const item = await connectDeviceProvider(provider, {
        platform: Platform.OS === "ios" ? "ios" : "android",
        deviceId: await getDeviceId(),
        osVersion: String(Platform.Version),
        grantedScopes: scopes,
        historyDepthDays: HEALTH_HISTORY_DEPTH_DAYS,
        profileSync: true,
      });
      const background = Platform.OS === "ios" || scopes.includes("background");
      await asyncStorageSyncStore.setCursor(userId, provider, null);
      await setActiveHealthSync({
        userId,
        provider,
        historyDepthDays: HEALTH_HISTORY_DEPTH_DAYS,
        profileSync: item.profileSync !== false,
        background,
      });
      if (background) {
        await enableHealthBackground().catch(() => undefined);
      }
      trackEvent("health_connected", { provider });
      void syncHealthNow("initial").then((result) => {
        trackSyncResult("initial", result);
        invalidateAfterHealthSync(queryClient);
      });
      return item;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });
    },
  });
}

export function useDisconnectHealth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const provider = requireProvider();
      await disconnectDeviceProvider(provider);
      await disableHealthBackground();
      await clearHealthSyncState(await currentUserId());
      trackEvent("health_disconnected", { provider });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });
    },
  });
}

export function useHealthSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await syncHealthNow("manual");
      trackSyncResult("manual", result);
      if (result?.status === "failed")
        throw result.error ?? new Error("Sync failed");
      return result;
    },
    onSettled: () => invalidateAfterHealthSync(queryClient),
  });
}

export function useSetHealthProfileSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileSync: boolean) => {
      const item = await updateDeviceConnection(requireProvider(), {
        profileSync,
      });
      await updateActiveHealthSync({ profileSync });
      return item;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });
    },
  });
}

/**
 * Health Connect: ask for records older than 30 days. A grant restarts the
 * read from scratch; the backend skips what it already has.
 */
export function useRequestHealthHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const provider = requireProvider();
      const scopes = await requireSource().requestPermissions({
        history: true,
        background: true,
      });
      await updateDeviceConnection(provider, { grantedScopes: scopes });
      if (scopes.includes("history")) {
        await asyncStorageSyncStore.setCursor(
          await currentUserId(),
          provider,
          null,
        );
        await syncHealthNow("backfill");
      }
      return scopes;
    },
    onSettled: () => invalidateAfterHealthSync(queryClient),
  });
}

export function useHealthSyncStatus(enabled: boolean) {
  const provider = platformHealthProvider();
  return useQuery({
    queryKey: queryKeys.integrations.sync(provider),
    queryFn: () => getDeviceSyncStatus(provider!),
    enabled: enabled && !!provider,
    refetchInterval: (query) =>
      (query.state.data?.pendingBatches ?? 0) > 0 ? 3000 : false,
  });
}

function trackSyncResult(
  syncType: string,
  result: Awaited<ReturnType<typeof syncHealthNow>>,
): void {
  if (!result) return;
  if (result.status === "failed") {
    trackEvent("health_sync_failed", { sync_type: syncType });
    return;
  }
  trackEvent("health_sync_completed", {
    sync_type: syncType,
    batches: result.batches,
    accepted: result.sentActivities,
    rejected: result.rejected,
  });
}

let lastForegroundSyncAt = 0;

/**
 * Mounted once in the signed-in shell: syncs when the app comes to the
 * foreground (at most every 15 minutes), follows server progress and drops
 * the local connection when the server says it is gone.
 */
export function useHealthSyncTriggers(): void {
  const queryClient = useQueryClient();
  const { item } = useHealthIntegration();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    const sync = () => {
      if (Date.now() - lastForegroundSyncAt < FOREGROUND_SYNC_INTERVAL_MS)
        return;
      lastForegroundSyncAt = Date.now();
      void syncHealthNow("foreground")
        .then((result) => {
          trackSyncResult("foreground", result);
          if (result && result.batches > 0)
            invalidateAfterHealthSync(queryClientRef.current);
        })
        .catch(() => undefined);
    };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (item?.status !== "disconnected") return;
    void getActiveHealthSync().then(async (active) => {
      if (!active) return;
      await disableHealthBackground();
      await clearHealthSyncState(active.userId);
    });
  }, [item?.status]);

  useRealtimeEvent("integration.sync_progress", () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.integrations.all,
    });
  });
  useRealtimeEvent("integrations.sync_completed", () =>
    invalidateAfterHealthSync(queryClient),
  );
}
