import { z } from "zod";

export interface ApiClientOptions {
  baseUrl: string;
}

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  permissions: z.array(z.string()).optional(),
});

export const authTokensSchema = z.object({
  tokenType: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  sessionId: z.string(),
  accessTokenExpiresIn: z.number(),
  user: authUserSchema,
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const authResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  newPassword: z.string().min(8),
});

export const authRequestEmailVerificationSchema = z.object({
  email: z.string().email(),
});

export const authVerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

export const mobileAuthEmailRequestSchema = z.object({
  email: z.string().email(),
});

export const mobileAuthEmailVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export const mobileAuthChallengeSchema = z.object({
  email: z.string().email(),
  expiresInSeconds: z.number().int().positive(),
  resendAfterSeconds: z.number().int().positive(),
});

export const mobileAuthSocialProviderSchema = z.enum(["google", "apple"]);

export const mobileAuthSocialSchema = z.object({
  provider: mobileAuthSocialProviderSchema,
  identityToken: z.string().min(1),
  email: z.string().email().optional(),
  fullName: z.string().optional(),
});

export const mobileAuthSocialExchangeSchema = z.object({
  code: z.string().min(1),
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type AuthForgotPasswordInput = z.infer<typeof authForgotPasswordSchema>;
export type AuthResetPasswordInput = z.infer<typeof authResetPasswordSchema>;
export type AuthRequestEmailVerificationInput = z.infer<typeof authRequestEmailVerificationSchema>;
export type AuthVerifyEmailInput = z.infer<typeof authVerifyEmailSchema>;
export type MobileAuthEmailRequestInput = z.infer<typeof mobileAuthEmailRequestSchema>;
export type MobileAuthEmailVerifyInput = z.infer<typeof mobileAuthEmailVerifySchema>;
export type MobileAuthChallenge = z.infer<typeof mobileAuthChallengeSchema>;
export type MobileAuthSocialProvider = z.infer<typeof mobileAuthSocialProviderSchema>;
export type MobileAuthSocialInput = z.infer<typeof mobileAuthSocialSchema>;
export type MobileAuthSocialExchangeInput = z.infer<typeof mobileAuthSocialExchangeSchema>;

export interface ApiErrorShape {
  statusCode?: number;
  message?: string;
  code?: string;
  path?: string;
  timestamp?: string;
  traceId?: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createApiClient({ baseUrl }: ApiClientOptions) {
  return async function request<TResponse>(input: string, init?: RequestInit): Promise<TResponse> {
    const response = await fetch(`${baseUrl}${input}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as ApiErrorShape | null;
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
  };
}
