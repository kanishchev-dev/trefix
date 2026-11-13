import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

import {
  authIdentityListSchema,
  authIdentitySchema,
  authSessionListSchema,
  dataExportSchema,
  dataExportStatusSchema,
  emailChangeChallengeSchema,
  type AuthIdentity,
  type AuthSession,
  type DataExport,
  type EmailChangeChallenge,
} from "@trefix/api-client";

import { request } from "./api-client";
import { getGoogleSigninModule } from "./google-signin";

export type SocialProvider = "apple" | "google";

export async function listSessions(): Promise<AuthSession[]> {
  const response = await request<unknown>("/auth/sessions", { useAuth: true });
  return authSessionListSchema.parse(response).items;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await request<void>(`/auth/sessions/${sessionId}`, {
    method: "DELETE",
    useAuth: true,
  });
}

export async function logoutOtherSessions(): Promise<void> {
  await request<void>("/auth/logout-others", { method: "POST", useAuth: true });
}

export async function listIdentities(): Promise<AuthIdentity[]> {
  const response = await request<unknown>("/auth/identities", {
    useAuth: true,
  });
  return authIdentityListSchema.parse(response).items;
}

/**
 * Runs the native Apple or Google sign-in only to prove the account and links
 * it to the signed-in user. `null` — the user cancelled the system dialog.
 */
export async function linkIdentity(
  provider: SocialProvider,
): Promise<AuthIdentity | null> {
  const credential =
    provider === "apple" ? await appleCredential() : await googleCredential();
  if (!credential) return null;
  const response = await request<unknown>(`/auth/identities/${provider}`, {
    method: "POST",
    body:
      provider === "apple"
        ? { authorizationCode: credential }
        : { idToken: credential },
    useAuth: true,
  });
  return authIdentitySchema.parse(response);
}

export async function unlinkIdentity(provider: SocialProvider): Promise<void> {
  await request<void>(`/auth/identities/${provider}`, {
    method: "DELETE",
    useAuth: true,
  });
}

export async function requestEmailChange(
  email: string,
): Promise<EmailChangeChallenge> {
  const response = await request<unknown>("/auth/email/change/request", {
    method: "POST",
    body: { email },
    useAuth: true,
  });
  return emailChangeChallengeSchema.parse(response);
}

export async function confirmEmailChange(code: string): Promise<void> {
  await request<void>("/auth/email/change/confirm", {
    method: "POST",
    body: { code },
    useAuth: true,
  });
}

export async function getLatestDataExport(): Promise<DataExport | null> {
  const response = await request<unknown>("/me/data-export", { useAuth: true });
  return dataExportStatusSchema.parse(response).latest;
}

export async function requestDataExport(): Promise<DataExport> {
  const response = await request<unknown>("/me/data-export", {
    method: "POST",
    useAuth: true,
  });
  return dataExportSchema.parse(response);
}

function isCancel(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "ERR_REQUEST_CANCELED" || code === "SIGN_IN_CANCELLED";
}

async function appleCredential(): Promise<string | null> {
  if (
    Platform.OS !== "ios" ||
    !(await AppleAuthentication.isAvailableAsync())
  ) {
    throw new Error("Sign in with Apple is not available on this device");
  }
  try {
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    return result.authorizationCode ?? null;
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
}

async function googleCredential(): Promise<string | null> {
  const module = getGoogleSigninModule();
  if (!module) {
    throw new Error(
      "Google Sign-In native module is unavailable in this build",
    );
  }
  const { GoogleSignin } = module;
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  try {
    const result = await GoogleSignin.signIn();
    if (result.type !== "success") return null;
    return result.data.idToken ?? null;
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
}
