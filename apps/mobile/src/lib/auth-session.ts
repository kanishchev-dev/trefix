import * as SecureStore from "expo-secure-store";

import { authTokensSchema, type AuthTokens } from "@workspace/api-client";

const AUTH_SESSION_KEY = "workspace.auth.session";

export async function loadAuthSession(): Promise<AuthTokens | null> {
  const rawSession = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return authTokensSchema.parse(JSON.parse(rawSession));
  } catch {
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
