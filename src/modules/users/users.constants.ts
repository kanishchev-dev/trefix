export const USER_INVITE_KEY_PREFIX = 'user:invite:';
export const USER_INVITE_ATTEMPTS_KEY_PREFIX = 'user:invite:attempts:';
export const USER_INVITE_CODE_LENGTH = 8;
export const USER_INVITE_TTL_SECONDS = 60 * 60 * 24 * 7;
export const USER_INVITE_MAX_ATTEMPTS = 5;

export const PREFERENCE_UNITS = ['metric', 'imperial'] as const;
/** Languages with full translations of user-facing texts (coach messages, emails, errors). */
export const PREFERENCE_LANGUAGES = ['ru', 'en'] as const;
export type PreferenceLanguage = (typeof PREFERENCE_LANGUAGES)[number];
export const PREFERENCE_WEEK_STARTS = ['mon', 'sun'] as const;
export const PREFERENCE_TIME_FORMATS = ['24h', '12h'] as const;
export const COACH_ADAPTATION_MODES = ['auto', 'confirm', 'suggest'] as const;
export const COACH_ADAPTATION_MODE_DEFAULT = 'confirm' as const;
/** `HH:MM`, 24-hour clock. */
export const QUIET_HOURS_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Hard purge of a deleted account happens within this delay. */
export const ACCOUNT_DELETION_QUEUE = 'account-deletion';
export const ACCOUNT_DELETION_JOB = 'account.purge';
export const ACCOUNT_DELETION_DELAY_MS = 60 * 60 * 1000;

export type PreferenceUnits = (typeof PREFERENCE_UNITS)[number];
export type PreferenceWeekStart = (typeof PREFERENCE_WEEK_STARTS)[number];
export type PreferenceTimeFormat = (typeof PREFERENCE_TIME_FORMATS)[number];
export type CoachAdaptationMode = (typeof COACH_ADAPTATION_MODES)[number];
export interface QuietHours {
  from: string;
  to: string;
}
