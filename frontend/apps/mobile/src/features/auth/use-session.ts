import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type AuthTokens } from "@trefix/api-client";

import {
  LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "../../app/use-app-preferences";
import { createQueryClient } from "../../app/query-client";
import { logout } from "../../lib/auth-api";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from "../../lib/auth-session";
import { getGoogleSigninModule } from "../../lib/google-signin";
import { logger } from "../../lib/logger";
import { useAuthSessionMonitor } from "../../lib/use-auth-session-monitor";
import { disableHealthBackground } from "../health-sync/background-control";
import { clearHealthSyncState } from "../health-sync/state";

/**
 * The signed-in session of the app: restored from secure storage on start,
 * kept fresh by the session monitor, and torn down on logout or account
 * deletion together with everything the next account must not inherit.
 */
export function useSession() {
  const [session, setSession] = useState<AuthTokens | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  // The query client lives for the app's lifetime; it reaches the current logout through a ref.
  const logoutRef = useRef<() => Promise<void>>(async () => undefined);
  const queryClient = useMemo(
    () => createQueryClient(() => void logoutRef.current()),
    [],
  );

  async function signOut(): Promise<void> {
    try {
      await logout();
    } catch (error) {
      logger.warn("Logout request failed:", error);
    } finally {
      // The next account on this device must not inherit Health sync or its background wake-ups.
      await disableHealthBackground();
      await clearHealthSyncState();
      await clearAuthSession();
      setSession(null);
      queryClient.clear();
    }
  }
  logoutRef.current = signOut;

  /** After the account is deleted: drop local data except language and theme, then end the session. */
  async function endDeletedAccount(): Promise<void> {
    await disableHealthBackground();
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(
        keys.filter(
          (key) => key !== LANGUAGE_STORAGE_KEY && key !== THEME_STORAGE_KEY,
        ),
      );
      await getGoogleSigninModule()?.GoogleSignin.signOut();
    } catch (error) {
      logger.warn("Local cleanup after account deletion failed:", error);
    }
    await clearAuthSession();
    setSession(null);
    queryClient.clear();
  }

  /** Stores the tokens of a fresh sign-in. */
  async function signIn(tokens: AuthTokens): Promise<void> {
    await saveAuthSession(tokens);
    setSession(tokens);
  }

  useAuthSessionMonitor({
    session,
    onSessionUpdated: setSession,
    onLogout: signOut,
  });

  useEffect(() => {
    let isActive = true;
    void loadAuthSession()
      .catch((error: unknown) => {
        logger.warn("Failed to restore the session:", error);
        return null;
      })
      .then((storedSession) => {
        if (isActive) {
          setSession(storedSession);
          setIsHydrating(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  return {
    session,
    isHydrating,
    queryClient,
    signIn,
    signOut,
    endDeletedAccount,
  };
}
