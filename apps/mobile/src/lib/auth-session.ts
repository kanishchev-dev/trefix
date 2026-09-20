import * as SecureStore from "expo-secure-store";

import { authTokensSchema, type AuthTokens } from "@workspace/api-client";

const AUTH_SESSION_KEY = "workspace.auth.session";

export async function loadAuthSession(): Promise<AuthTokens | null> {
  const rawSession = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession);
    return authTokensSchema.parse(session);
  } catch (error) {
    console.warn("[AuthSession] Failed to parse session, clearing:", error);
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    return null;
  }
}

export async function saveAuthSession(session: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}
