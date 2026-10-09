import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

import {
  authTokensSchema,
  authUserSchema,
  mobileAuthChallengeSchema,
  mobileAuthEmailRequestSchema,
  mobileAuthEmailVerifySchema,
  appleNativeExchangeSchema,
  googleNativeExchangeSchema,
  updateUserSchema,
  ApiClientError,
  type AuthTokens,
  type AuthUser,
  type UpdateUserInput,
  type MobileAuthChallenge,
  type MobileAuthEmailRequestInput,
  type MobileAuthEmailVerifyInput,
  type AppleNativeExchangeInput,
  type GoogleNativeExchangeInput,
  type ApiErrorShape,
} from "@workspace/api-client";

import { getGoogleSigninModule } from "./google-signin";
import { loadAuthSession, saveAuthSession } from "./auth-session";
import { request } from "./api-client";
import { BACKEND_BASE_URL } from "./backend-url";

const AUTH_BACKEND_BASE_URL = BACKEND_BASE_URL;

export async function requestEmailOtp(
  email: string,
): Promise<MobileAuthChallenge> {
  const payload = mobileAuthEmailRequestSchema.parse({ email });
  const response = await request<unknown>("/auth/email/otp/request", {
    method: "POST",
    body: payload satisfies MobileAuthEmailRequestInput,
  });
  return mobileAuthChallengeSchema.parse(response);
}

export async function verifyEmailOtp(
  email: string,
  code: string,
): Promise<AuthTokens> {
  const payload = mobileAuthEmailVerifySchema.parse({ email, code });
  const response = await request<unknown>("/auth/email/otp/verify", {
    method: "POST",
    body: payload satisfies MobileAuthEmailVerifyInput,
  });
  return authTokensSchema.parse(response);
}

export async function signInWithAppleNative(): Promise<AuthTokens | null> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error("Sign in with Apple is not available on this device");
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.authorizationCode) {
      throw new Error("Apple sign-in did not return an authorization code");
    }

    const payload = appleNativeExchangeSchema.parse({
      authorizationCode: credential.authorizationCode,
    }) satisfies AppleNativeExchangeInput;

    const response = await request<unknown>("/auth/social/apple/native", {
      method: "POST",
      body: payload,
    });

    return authTokensSchema.parse(response);
  } catch (error) {
    if (
      error instanceof Error &&
      (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return null;
    }

    throw error;
  }
}

export async function signInWithGoogleNative(): Promise<AuthTokens | null> {
  try {
    const googleSigninModule = getGoogleSigninModule();
    if (!googleSigninModule) {
      throw new Error(
        "Google Sign-In native module is unavailable in this build",
      );
    }

    const { GoogleSignin } = googleSigninModule;

    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    const result = await GoogleSignin.signIn();
    if (result.type !== "success") {
      return null;
    }

    if (!result.data.idToken) {
      throw new Error("Google sign-in did not return an ID token");
    }

    const payload = googleNativeExchangeSchema.parse({
      idToken: result.data.idToken,
    }) satisfies GoogleNativeExchangeInput;
    const response = await request<unknown>("/auth/social/google/native", {
      method: "POST",
      body: payload,
    });

    return authTokensSchema.parse(response);
  } catch (error) {
    const code = (error as { code?: string | number } | null)?.code;
    if (code === "SIGN_IN_CANCELLED" || code === "CANCELED" || code === 12501) {
      return null;
    }

    throw error;
  }
}

let activeRefreshPromise: Promise<AuthTokens | null> | null = null;

export async function refreshAuthTokens(
  existingRefreshToken?: string,
): Promise<AuthTokens | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const session = await loadAuthSession();
      const tokenToUse = existingRefreshToken || session?.refreshToken;
      if (!tokenToUse) {
        console.warn("[AuthAPI] No refresh token available to refresh session");
        return null;
      }

      console.log("[AuthAPI] Refreshing auth tokens via POST /auth/refresh...");
      const response = await request<unknown>("/auth/refresh", {
        method: "POST",
        body: { refreshToken: tokenToUse },
        skipAutoRefresh: true,
      });

      const newTokens = authTokensSchema.parse(response);
      await saveAuthSession(newTokens);
      console.log("[AuthAPI] Auth tokens refreshed successfully!");
      return newTokens;
    } catch (error) {
      console.warn("[AuthAPI] Failed to refresh auth tokens:", error);
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function getMe(): Promise<AuthUser> {
  const response = await request<unknown>("/auth/me", {
    method: "GET",
    useAuth: true,
  });
  return authUserSchema.parse(response);
}

export async function logout(): Promise<void> {
  await request<void>("/auth/logout", {
    method: "POST",
    useAuth: true,
  });
}

/** Deletes the account and all data permanently; every session ends at once. */
export async function deleteAccount(): Promise<void> {
  await request<void>("/auth/me", {
    method: "DELETE",
    body: { confirm: true },
    useAuth: true,
  });
}

export async function updateMe(data: UpdateUserInput): Promise<AuthUser> {
  const payload = updateUserSchema.parse(data);
  const response = await request<unknown>("/auth/me", {
    method: "PATCH",
    body: payload satisfies UpdateUserInput,
    useAuth: true,
  });
  return authUserSchema.parse(response);
}

export async function uploadAvatar(uri: string): Promise<string> {
  const formData = new FormData();

  // Extract filename from URI
  const filename = uri.split('/').pop() || 'avatar.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  // @ts-expect-error: React Native FormData needs object with uri, name, type
  formData.append('file', {
    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
    name: filename,
    type,
  });

  const session = await loadAuthSession();
  // Public avatar endpoint: stores the file, updates the user and returns a link
  // that loads without a token (the storage file endpoint requires one).
  const url = `${AUTH_BACKEND_BASE_URL}/avatars/me`;

  console.log(`[AuthAPI] Uploading avatar to: ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session?.accessToken}`,
      },
    });

    console.log(`[AuthAPI] Upload status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No body");
      console.error(`[AuthAPI] Upload failed body: ${errorText}`);

      let errorBody: ApiErrorShape = {};
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        // Not JSON
      }

      throw new ApiClientError(
        errorBody.message || "Avatar upload failed",
        response.status,
        errorBody.code,
        errorBody,
      );
    }

    const data = (await response.json()) as { avatarUrl: string };
    console.log(`[AuthAPI] Avatar uploaded: ${data.avatarUrl}`);
    return data.avatarUrl;
  } catch (error) {
    console.error(`[AuthAPI] Avatar upload exception:`, error);
    throw error;
  }
}
