import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { type AuthTokens } from "@trefix/api-client";
import { getJwtExpirationMs, isJwtExpired } from "./jwt-utils";
import { refreshAuthTokens } from "./auth-api";
import { logger } from "./logger";

type UseAuthSessionMonitorOptions = {
  session: AuthTokens | null;
  onSessionUpdated: (session: AuthTokens) => void;
  onLogout: () => Promise<void> | void;
};

// Attempt silent token refresh 30 seconds before access token expires
const REFRESH_BUFFER_SECONDS = 30;

/**
 * Keeps the access token fresh: refreshes it shortly before expiry and when
 * the app returns to the foreground. Logs out only when the backend rejects
 * the session; a refresh that fails offline is retried on the next trigger
 * (and every API call refreshes on 401 by itself).
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
      let newTokens: AuthTokens | null;
      try {
        newTokens = await refreshAuthTokens();
      } catch (error) {
        logger.warn(
          "[useAuthSessionMonitor] Refresh failed, will retry later",
          error,
        );
        return;
      }
      if (newTokens) {
        onSessionUpdatedRef.current(newTokens);
      } else if (!isLoggingOutRef.current) {
        isLoggingOutRef.current = true;
        void onLogoutRef.current();
      }
    }

    // 1. Immediate check on session change
    if (isJwtExpired(accessToken, 0)) {
      void attemptRefreshOrLogout();
      return;
    }

    // 2. Proactive refresh shortly before expiry.
    const expMs = getJwtExpirationMs(accessToken);
    let refreshTimerId: ReturnType<typeof setTimeout> | undefined;
    if (expMs) {
      const msUntilRefresh = Math.max(
        0,
        expMs - Date.now() - REFRESH_BUFFER_SECONDS * 1000,
      );
      refreshTimerId = setTimeout(() => {
        void attemptRefreshOrLogout();
      }, msUntilRefresh);
    }

    // 3. Monitor AppState foreground transitions
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      if (nextAppState === "active") {
        if (isJwtExpired(accessToken, REFRESH_BUFFER_SECONDS)) {
          void attemptRefreshOrLogout();
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      if (refreshTimerId) clearTimeout(refreshTimerId);
      subscription.remove();
    };
  }, [session?.accessToken]);
}
