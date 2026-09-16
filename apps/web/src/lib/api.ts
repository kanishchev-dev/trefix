import {
  ApiClientError,
  authForgotPasswordSchema,
  authLoginSchema,
  authResetPasswordSchema,
  authRequestEmailVerificationSchema,
  authTokensSchema,
  authUserSchema,
  authVerifyEmailSchema,
  type AuthForgotPasswordInput,
  type AuthLoginInput,
  type AuthResetPasswordInput,
  type AuthRequestEmailVerificationInput,
  type AuthTokens,
  type AuthUser,
  type AuthVerifyEmailInput,
} from "@workspace/api-client";

import { authPaths } from "@/lib/auth";

type ApiMethod = "GET" | "POST";

async function request<TResponse>(
  path: string,
  options?: {
    method?: ApiMethod;
    body?: unknown;
  },
): Promise<TResponse> {
  const response = await fetch(path, {
    method: options?.method ?? "GET",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
      statusCode?: number;
    } | null;
    throw new ApiClientError(
      errorBody?.message || `Request failed with status ${response.status}`,
      response.status,
      errorBody?.code,
      errorBody,
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function login(input: AuthLoginInput): Promise<AuthTokens> {
  const payload = authLoginSchema.parse(input);
  const response = await request<unknown>(authPaths.login, {
    method: "POST",
    body: payload,
  });
  return authTokensSchema.parse(response);
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await request<unknown>(authPaths.me);
  return authUserSchema.parse(response);
}

export async function refreshSession(): Promise<AuthTokens> {
  const response = await request<unknown>(authPaths.refresh, {
    method: "POST",
  });
  return authTokensSchema.parse(response);
}

export async function logout(): Promise<void> {
  await request<void>(authPaths.logout, { method: "POST" });
}

export async function logoutAll(): Promise<void> {
  await request<void>(authPaths.logoutAll, { method: "POST" });
}

export async function requestPasswordReset(
  input: AuthForgotPasswordInput,
): Promise<void> {
  const payload = authForgotPasswordSchema.parse(input);
  await request<void>(authPaths.passwordResetRequest, {
    method: "POST",
    body: payload,
  });
}

export async function confirmPasswordReset(
  input: AuthResetPasswordInput,
): Promise<void> {
  const payload = authResetPasswordSchema.parse(input);
  await request<void>(authPaths.passwordResetConfirm, {
    method: "POST",
    body: payload,
  });
}

export async function verifyEmail(input: AuthVerifyEmailInput): Promise<void> {
  const payload = authVerifyEmailSchema.parse(input);
  await request<void>(authPaths.emailVerify, { method: "POST", body: payload });
}

export async function resendVerification(
  input: AuthRequestEmailVerificationInput,
): Promise<void> {
  const payload = authRequestEmailVerificationSchema.parse(input);
  await request<void>(authPaths.emailResend, { method: "POST", body: payload });
}
