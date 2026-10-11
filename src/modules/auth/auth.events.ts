/**
 * Names of in-process domain events published by the auth module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const AUTH_EVENTS = {
  EMAIL_OTP_REQUESTED: 'auth.email_otp_requested',
  EMAIL_VERIFIED: 'auth.email_verified',
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  REGISTERED: 'auth.registered',
  SESSION_CREATED: 'auth.session.created',
  SESSION_REVOKED: 'auth.session.revoked',
} as const;

export type AuthEventName = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS];
