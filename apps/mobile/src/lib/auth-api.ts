import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

import {
  authTokensSchema,
  mobileAuthChallengeSchema,
  mobileAuthEmailRequestSchema,
  mobileAuthEmailVerifySchema,
  appleNativeExchangeSchema,
  googleNativeExchangeSchema,
  type AuthTokens,
  type MobileAuthChallenge,
  type MobileAuthEmailRequestInput,
  type MobileAuthEmailVerifyInput,
  type AppleNativeExchangeInput,
  type GoogleNativeExchangeInput,
} from "@workspace/api-client";

import { getGoogleSigninModule } from "./google-signin";

const AUTH_BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_AUTH_BACKEND_URL ?? "http://127.0.0.1:3000/v1";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function request<TResponse>(
  path: string,
  options?: RequestOptions,
): Promise<TResponse> {
  const response = await fetch(`${AUTH_BACKEND_BASE_URL}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;
    throw new Error(
      errorBody?.message ?? `Request failed with status ${response.status}`,
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

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
