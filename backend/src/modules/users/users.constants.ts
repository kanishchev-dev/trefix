export const USER_INVITE_KEY_PREFIX = 'user:invite:';
export const USER_INVITE_ATTEMPTS_KEY_PREFIX = 'user:invite:attempts:';
export const USER_INVITE_CODE_LENGTH = 8;
export const USER_INVITE_TTL_SECONDS = 60 * 60 * 24 * 7;
export const USER_INVITE_MAX_ATTEMPTS = 5;

export const USER_BIO_MAX_LENGTH = 300;

export const PREFERENCE_DISTANCE_UNITS = ['km', 'mi'] as const;
export const PREFERENCE_WEIGHT_UNITS = ['kg', 'lb'] as const;
export const PREFERENCE_HEIGHT_UNITS = ['cm', 'ft'] as const;
export const PREFERENCE_TEMPERATURE_UNITS = ['c', 'f'] as const;
/** Languages with full translations of user-facing texts (coach messages, emails, errors). */
export const PREFERENCE_LANGUAGES = ['ru', 'en'] as const;
export type PreferenceLanguage = (typeof PREFERENCE_LANGUAGES)[number];
/** What the user picked in the app; `system` follows the device language. */
export const PREFERENCE_LANGUAGE_MODES = ['system', ...PREFERENCE_LANGUAGES] as const;
export type PreferenceLanguageMode = (typeof PREFERENCE_LANGUAGE_MODES)[number];
export const PREFERENCE_WEEK_STARTS = ['mon', 'sun'] as const;
export const PREFERENCE_TIME_FORMATS = ['24h', '12h'] as const;
export const COACH_ADAPTATION_MODES = ['auto', 'confirm', 'suggest'] as const;
export const COACH_ADAPTATION_MODE_DEFAULT = 'confirm' as const;
export const COACH_TONES = ['soft', 'neutral', 'strict'] as const;
export const COACH_TONE_DEFAULT = 'neutral' as const;
/** Topics of messages the coach starts on its own; each can be switched off separately. */
export const COACH_PROACTIVE_TOPICS = [
  'preWorkout',
  'workoutReview',
  'wellbeingCheck',
  'weeklySummary',
  'missedSupport',
] as const;
/** When to remind about a planned workout: the morning of the day or a fixed lead time. */
export const WORKOUT_REMINDER_TIMES = ['morning', '2h', '1h', '30m'] as const;
export const NOTIFICATION_FLAGS = [
  'workoutReminder',
  'missedWorkout',
  'planChanged',
  'achievements',
  'workoutSynced',
] as const;
/** `HH:MM`, 24-hour clock. */
export const QUIET_HOURS_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Hard purge of a deleted account happens within this delay. */
export const ACCOUNT_DELETION_QUEUE = 'account-deletion';
export const ACCOUNT_DELETION_JOB = 'account.purge';
export const ACCOUNT_DELETION_DELAY_MS = 60 * 60 * 1000;

export type PreferenceDistanceUnit = (typeof PREFERENCE_DISTANCE_UNITS)[number];
export type PreferenceWeightUnit = (typeof PREFERENCE_WEIGHT_UNITS)[number];
export type PreferenceHeightUnit = (typeof PREFERENCE_HEIGHT_UNITS)[number];
export type PreferenceTemperatureUnit = (typeof PREFERENCE_TEMPERATURE_UNITS)[number];
export type CoachTone = (typeof COACH_TONES)[number];
export type CoachProactiveTopic = (typeof COACH_PROACTIVE_TOPICS)[number];
export type CoachProactiveSettings = Record<CoachProactiveTopic, boolean>;
export type WorkoutReminderTime = (typeof WORKOUT_REMINDER_TIMES)[number];
export type NotificationFlag = (typeof NOTIFICATION_FLAGS)[number];
export type NotificationSettings = Record<NotificationFlag, boolean> & { workoutReminderTime: WorkoutReminderTime };

export const COACH_PROACTIVE_DEFAULTS: CoachProactiveSettings = {
  preWorkout: true,
  workoutReview: true,
  wellbeingCheck: true,
  weeklySummary: true,
  missedSupport: true,
};
export const NOTIFICATION_DEFAULTS: NotificationSettings = {
  workoutReminder: true,
  workoutReminderTime: 'morning',
  missedWorkout: true,
  planChanged: true,
  achievements: true,
  workoutSynced: false,
};
export type PreferenceWeekStart = (typeof PREFERENCE_WEEK_STARTS)[number];
export type PreferenceTimeFormat = (typeof PREFERENCE_TIME_FORMATS)[number];
export type CoachAdaptationMode = (typeof COACH_ADAPTATION_MODES)[number];
export interface QuietHours {
  from: string;
  to: string;
}
