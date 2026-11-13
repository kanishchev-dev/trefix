/** Sections of the admin panel an activity event belongs to; used for filtering. */
export const ACTIVITY_DOMAINS = [
  'account',
  'access',
  'athlete',
  'workouts',
  'plans',
  'progress',
  'gear',
  'integrations',
  'coach',
  'preferences',
  'notifications',
  'data_access',
  'settings',
] as const;
export type ActivityDomain = (typeof ACTIVITY_DOMAINS)[number];

export const ACTIVITY_WRITE_QUEUE = 'activity-write';
export const ACTIVITY_WRITE_JOB = 'activity.write';
export const ACTIVITY_ERASE_JOB = 'activity.erase';
export const ACTIVITY_RETENTION_QUEUE = 'activity-retention';
export const ACTIVITY_RETENTION_JOB = 'activity.retention';

/** Default retention of ordinary events; admin actions and data access are kept forever. */
export const ACTIVITY_RETENTION_DAYS_DEFAULT = 730;

export const ACTIVITY_PAGE_LIMIT_DEFAULT = 50;
export const ACTIVITY_PAGE_LIMIT_MAX = 100;
export const ACTIVITY_EXPORT_ROW_LIMIT = 50_000;
export const ACTIVITY_EXPORT_BATCH_SIZE = 1_000;

/** Repeated views of the same resource by the same admin are recorded once per window. */
export const DATA_ACCESS_DEDUP_TTL_SECONDS = 10 * 60;

export const ACTIVITY_ERROR_CODES = {
  cursorInvalid: 'ACTIVITY_CURSOR_INVALID',
} as const;
