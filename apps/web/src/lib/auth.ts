import { authForgotPasswordSchema, authLoginSchema, authResetPasswordSchema, authRequestEmailVerificationSchema, authTokensSchema, authUserSchema, authVerifyEmailSchema, type AuthForgotPasswordInput, type AuthLoginInput, type AuthResetPasswordInput, type AuthRequestEmailVerificationInput, type AuthTokens, type AuthUser, type AuthVerifyEmailInput } from "@workspace/api-client";

export {
  authForgotPasswordSchema,
  authLoginSchema,
  authResetPasswordSchema,
  authRequestEmailVerificationSchema,
  authTokensSchema,
  authUserSchema,
  authVerifyEmailSchema,
};

export type {
  AuthForgotPasswordInput,
  AuthLoginInput,
  AuthResetPasswordInput,
  AuthRequestEmailVerificationInput,
  AuthTokens,
  AuthUser,
  AuthVerifyEmailInput,
};

export const authPaths = {
  login: "/api/auth/login",
  me: "/api/auth/me",
  refresh: "/api/auth/refresh",
  logout: "/api/auth/logout",
  logoutAll: "/api/auth/logout-all",
  passwordResetRequest: "/api/auth/password/reset/request",
  passwordResetConfirm: "/api/auth/password/reset/confirm",
  emailVerify: "/api/auth/email/verify",
  emailResend: "/api/auth/email/resend",
} as const;

export const authPermissions = {
  usersRead: "users.read",
  usersManage: "users.manage",
  permissionsRead: "permissions.read",
  permissionsManage: "permissions.manage",
} as const;
