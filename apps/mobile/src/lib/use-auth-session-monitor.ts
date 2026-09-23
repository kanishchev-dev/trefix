import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { type AuthTokens } from "@workspace/api-client";
import { getJwtExpirationMs, isJwtExpired } from "./jwt-utils";
import { refreshAuthTokens } from "./auth-api";

type UseAuthSessionMonitorOptions = {
  session: AuthTokens | null;
  onSessionUpdated: (session: AuthTokens) => void;
  onLogout: () => Promise<void> | void;
};

// Attempt silent token refresh 30 seconds before access token expires
const REFRESH_BUFFER_SECONDS = 30;

/**
 * Hook that monitors JWT token expiration in real time.
 * - Proactively performs silent refresh 30 seconds before token expiration.
 * - On app foreground transition, refreshes if token is near expiration, or logs out if refresh fails.
 */
export function useAuthSessionMonitor({
  session,
  onSessionUpdated,
  onLogout,
}: UseAuthSessionMonitorOptions): void {
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const onSessionUpdatedRef = useRef(onSessionUpdated);
  onSessionUpdatedRef.current = onSessionUpdated;

  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    isLoggingOutRef.current = false;
  }, [session]);

  useEffect(() => {
    const accessToken = session?.accessToken;
    if (!accessToken) {
      return;
    }

    async function attemptRefreshOrLogout(): Promise<void> {
      console.log("[useAuthSessionMonitor] Token expired or near expiry. Attempting silent refresh...");
      const newTokens = await refreshAuthTokens();
      if (newTokens) {
        console.log("[useAuthSessionMonitor] Silent refresh succeeded!");
        onSessionUpdatedRef.current(newTokens);
      } else {
        console.warn("[useAuthSessionMonitor] Refresh failed. Logging out...");
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          void onLogoutRef.current();
        }
      }
    }

    // 1. Immediate check on session change
    if (isJwtExpired(accessToken, 0)) {
      void attemptRefreshOrLogout();
      return;
    }

    // 2. Set timer for proactive silent refresh (30s before exp)
    const expMs = getJwtExpirationMs(accessToken);
    let refreshTimerId: ReturnType<typeof setTimeout> | undefined;
    let logoutTimerId: ReturnType<typeof setTimeout> | undefined;

    if (expMs) {
      const totalRemainingMs = expMs - Date.now();
      const msUntilRefresh = Math.max(0, totalRemainingMs - REFRESH_BUFFER_SECONDS * 1000);

      console.log(
        `[useAuthSessionMonitor] Token active. Proactive refresh in ${Math.round(msUntilRefresh / 1000)}s (exp in ${Math.round(totalRemainingMs / 1000)}s)`,
      );

      refreshTimerId = setTimeout(() => {
        void attemptRefreshOrLogout();
      }, msUntilRefresh);

      // Hard expiry timer fallback
      logoutTimerId = setTimeout(() => {
        console.log("[useAuthSessionMonitor] Hard expiration timer fired!");
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          void onLogoutRef.current();
        }
      }, totalRemainingMs);
    }

    // 3. Monitor AppState foreground transitions
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      if (nextAppState === "active") {
        if (isJwtExpired(accessToken, REFRESH_BUFFER_SECONDS)) {
          console.log("[useAuthSessionMonitor] App active & token near/past expiry. Refreshing...");
          void attemptRefreshOrLogout();
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      if (refreshTimerId) clearTimeout(refreshTimerId);
      if (logoutTimerId) clearTimeout(logoutTimerId);
      subscription.remove();
    };
  }, [session?.accessToken]);
}
