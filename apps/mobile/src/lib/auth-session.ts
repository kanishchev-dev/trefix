import * as SecureStore from "expo-secure-store";

import { authTokensSchema, type AuthTokens } from "@trefix/api-client";
import { logger } from "./logger";

const AUTH_SESSION_KEY = "workspace.auth.session";

/**
 * Readable after the first unlock since boot: Health background sync runs
 * while the phone is locked and still has to authenticate.
 */
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

let accessibilityMigrated = false;

export async function loadAuthSession(): Promise<AuthTokens | null> {
  const rawSession = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    const session = authTokensSchema.parse(JSON.parse(rawSession));
    if (!accessibilityMigrated) {
      // Sessions saved before AFTER_FIRST_UNLOCK keep the old attribute until rewritten.
      accessibilityMigrated = true;
      await SecureStore.setItemAsync(
        AUTH_SESSION_KEY,
        rawSession,
        STORE_OPTIONS,
      ).catch(() => undefined);
    }
    return session;
  } catch (error) {
    logger.warn("[AuthSession] Failed to parse session, clearing:", error);
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    return null;
  }
}

export async function saveAuthSession(session: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(
    AUTH_SESSION_KEY,
    JSON.stringify(session),
    STORE_OPTIONS,
  );
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}
