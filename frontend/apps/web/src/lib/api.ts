import {
  ApiClientError,
  authForgotPasswordSchema,
  authLoginSchema,
  authResetPasswordSchema,
  authRequestEmailVerificationSchema,
  browserSessionSchema,
  authUserSchema,
  authVerifyEmailSchema,
  changePasswordSchema,
  updateUserSchema,
  type AuthActivateInviteInput,
  type AuthForgotPasswordInput,
  type AuthLoginInput,
  type AuthResetPasswordInput,
  type AuthRequestEmailVerificationInput,
  type BrowserSession,
  type AuthUser,
  type AuthVerifyEmailInput,
  type ChangePasswordInput,
  type UpdateUserInput,
} from "@trefix/api-client";

import { authPaths } from "@/lib/auth";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Query string values; arrays become repeated parameters rather than a joined blob. */
type SearchParamValue = string | number | readonly string[] | undefined;

async function request<TResponse>(
  path: string,
  options?: {
    method?: ApiMethod;
    body?: unknown;
    searchParams?: Record<string, SearchParamValue>;
  },
): Promise<TResponse> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options?.searchParams ?? {})) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      // `?ids=a&ids=b`, the form Nest's array validation reads back cleanly.
      // String-joining would instead produce one parameter holding "a,b".
      for (const entry of value) {
        search.append(key, entry);
      }
      continue;
    }

    search.set(key, String(value));
  }

  const queryString = search.toString();
  const url = queryString.length > 0 ? `${path}?${queryString}` : path;

  const response = await fetch(url, {
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

  /**
   * Endpoints that only mutate state answer with an empty body, and some of
   * them use 200/201 rather than 204. Calling `response.json()` on those throws
   * "Unexpected end of JSON input", which surfaced as a crash right after a
   * successful request. Reading the text first keeps the void responses safe
   * regardless of the status the endpoint chose.
   */
  const body = await response.text();

  return (body ? JSON.parse(body) : undefined) as TResponse;
}

export async function login(input: AuthLoginInput): Promise<BrowserSession> {
  const payload = authLoginSchema.parse(input);
  const response = await request<unknown>(authPaths.login, {
    method: "POST",
    body: payload,
  });
  return browserSessionSchema.parse(response);
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await request<unknown>(authPaths.me);
  return authUserSchema.parse(response);
}

export async function refreshSession(): Promise<BrowserSession> {
  const response = await request<unknown>(authPaths.refresh, {
    method: "POST",
  });
  return browserSessionSchema.parse(response);
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

/**
 * Completes the admin invite flow: the invited user sets their own password
 * and is signed in immediately on success.
 */
export async function activateInvite(
  input: AuthActivateInviteInput,
): Promise<BrowserSession> {
  const response = await request<unknown>(authPaths.inviteActivate, {
    method: "POST",
    body: input,
  });
  return browserSessionSchema.parse(response);
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

/**
 * Updates the own profile. The backend answers with the fresh user, so the
 * caller can replace its cached copy without a second round trip.
 */
export async function updateProfile(input: UpdateUserInput): Promise<AuthUser> {
  const payload = updateUserSchema.parse(input);
  const response = await request<unknown>(authPaths.me, {
    method: "PATCH",
    body: payload,
  });

  return authUserSchema.parse(response);
}

/**
 * Changes the own password. The backend rotates the session and returns fresh
 * tokens, which the caller keeps in its auth store.
 */
export async function changePassword(
  input: ChangePasswordInput,
): Promise<BrowserSession> {
  const payload = changePasswordSchema.parse(input);
  const response = await request<unknown>(authPaths.passwordChange, {
    method: "POST",
    body: payload,
  });

  return browserSessionSchema.parse(response);
}

export { request as apiRequest };
