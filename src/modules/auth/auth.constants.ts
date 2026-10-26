export const AUTH_MODULE_NAME = 'AuthModule';
export const AUTH_ACCESS_TOKEN_TYPE = 'access';
export const AUTH_REFRESH_TOKEN_TYPE = 'refresh';
export const AUTH_TOKEN_ISSUER = 'trefix';
export const AUTH_EMAIL_VERIFICATION_CODE_LENGTH = 4;
export const AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
export const AUTH_PASSWORD_RESET_CODE_LENGTH = 4;
export const AUTH_PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const AUTH_DEFAULT_DISPLAY_NAME = 'User';
/**
 * How long the refresh token replaced by a rotation is still honoured. A phone
 * that loses the refresh response (timeout, app suspended, flaky network) keeps
 * the old token; without this window its next refresh looks like token theft
 * and signs the user out on every device.
 */
export const AUTH_REFRESH_REUSE_GRACE_MS = 2 * 60 * 1000;
export const AUTH_EMAIL_VERIFICATION_TEMPLATE = 'auth/verification';
export const AUTH_PASSWORD_RESET_TEMPLATE = 'auth/password-reset';
export const AUTH_EMAIL_OTP_TEMPLATE = 'auth/email-otp';
export const AUTH_PASSWORD_HASH_ROUNDS = 12;
export const AUTH_SESSION_REDIS_PREFIX = 'auth:session:';
export const AUTH_SESSION_IDS_REDIS_PREFIX = 'auth:user-sessions:';
export const AUTH_EMAIL_VERIFICATION_REDIS_PREFIX = 'auth:email-verification:';
export const AUTH_EMAIL_VERIFICATION_COOLDOWN_REDIS_PREFIX = 'auth:email-verification-cooldown:';
export const AUTH_EMAIL_OTP_REDIS_PREFIX = 'auth:email-otp:';
export const AUTH_EMAIL_OTP_COOLDOWN_REDIS_PREFIX = 'auth:email-otp-cooldown:';
export const AUTH_SOCIAL_STATE_REDIS_PREFIX = 'auth:social-state:';
export const AUTH_SOCIAL_RESULT_REDIS_PREFIX = 'auth:social-result:';
export const AUTH_PASSWORD_RESET_REDIS_PREFIX = 'auth:password-reset:';

/** Headers the apps send so sessions can be shown as devices. */
export const AUTH_CLIENT_DEVICE_HEADER = 'x-client-device';
export const AUTH_CLIENT_PLATFORM_HEADER = 'x-client-platform';
export const AUTH_CLIENT_APP_VERSION_HEADER = 'x-client-app-version';
export const AUTH_CLIENT_HEADER_MAX_LENGTH = 120;

export const AUTH_EMAIL_CHANGE_REDIS_PREFIX = 'auth:email-change:';
export const AUTH_EMAIL_CHANGE_TEMPLATE = 'auth/email-change';
