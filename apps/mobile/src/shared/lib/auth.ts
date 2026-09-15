import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import * as SecureStore from "expo-secure-store";

import {
  ApiClientError,
  authTokensSchema,
  authUserSchema,
  createApiClient,
  mobileAuthChallengeSchema,
  mobileAuthEmailRequestSchema,
  mobileAuthEmailVerifySchema,
  mobileAuthSocialExchangeSchema,
  mobileAuthSocialProviderSchema,
  type AuthTokens,
  type AuthUser,
  type MobileAuthChallenge,
  type MobileAuthEmailRequestInput,
  type MobileAuthEmailVerifyInput,
  type MobileAuthSocialExchangeInput,
  type MobileAuthSocialProvider,
} from "@workspace/api-client";

const keys = {
  authSession: "workspace.mobile.auth-session",
} as const;

export type AuthSession = {
  tokens: AuthTokens;
  user: AuthUser;
};

function resolveApiBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  return baseUrl && baseUrl.trim().length > 0 ? baseUrl.replace(/\/$/, "") : "http://localhost:3000";
}

const request = createApiClient({ baseUrl: resolveApiBaseUrl() });
const mobileSocialRedirectUri = "workspace-mobile://auth/callback";

export async function loadAuthSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(keys.authSession);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const tokens = authTokensSchema.parse((parsed as { tokens?: unknown }).tokens);
    const user = authUserSchema.parse((parsed as { user?: unknown }).user);
    return { tokens, user };
  } catch {
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(keys.authSession, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(keys.authSession);
}

export async function requestEmailAuthCode(
  input: MobileAuthEmailRequestInput,
): Promise<MobileAuthChallenge> {
  const payload = mobileAuthEmailRequestSchema.parse(input);
  const response = await request<unknown>("/v1/auth/mobile/email/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return mobileAuthChallengeSchema.parse(response);
}

export async function verifyEmailAuthCode(input: MobileAuthEmailVerifyInput): Promise<AuthSession> {
  const payload = mobileAuthEmailVerifySchema.parse(input);
  const response = await request<unknown>("/v1/auth/mobile/email/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const tokens = authTokensSchema.parse(response);
  return {
    tokens,
    user: tokens.user,
  };
}

export async function loadCurrentUser(accessToken: string): Promise<AuthUser> {
  const response = await request<unknown>("/v1/auth/me", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  return authUserSchema.parse(response);
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthSession> {
  const response = await request<unknown>("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  const tokens = authTokensSchema.parse(response);
  return {
    tokens,
    user: tokens.user,
  };
}

export async function logoutAuthSession(accessToken: string): Promise<void> {
  await request<void>("/v1/auth/logout", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function startMobileSocialAuth(provider: MobileAuthSocialProvider): Promise<void> {
  const normalizedProvider = mobileAuthSocialProviderSchema.parse(provider);
  const startUrl = `${resolveApiBaseUrl()}/v1/auth/mobile/social/${normalizedProvider}/start?redirectUri=${encodeURIComponent(mobileSocialRedirectUri)}`;
  await Linking.openURL(startUrl);
}

export async function exchangeMobileSocialAuthCode(
  input: MobileAuthSocialExchangeInput,
): Promise<AuthSession> {
  const payload = mobileAuthSocialExchangeSchema.parse(input);
  const response = await request<unknown>("/v1/auth/mobile/social/exchange", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const tokens = authTokensSchema.parse(response);
  return {
    tokens,
    user: tokens.user,
  };
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export async function loadStoredThemePreference(): Promise<"light" | "dark" | null> {
  const value = await AsyncStorage.getItem("workspace.mobile.theme");
  return value === "light" || value === "dark" ? value : null;
}

export async function saveThemePreference(value: "light" | "dark"): Promise<void> {
  await AsyncStorage.setItem("workspace.mobile.theme", value);
}
