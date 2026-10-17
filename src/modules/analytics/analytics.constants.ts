/** Reporting periods of the dashboard; the current period ends today. */
export const ANALYTICS_PERIODS = ['7d', '30d', '90d', '12m'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
export const ANALYTICS_PERIOD_DAYS: Record<AnalyticsPeriod, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
export const ANALYTICS_PERIOD_DEFAULT: AnalyticsPeriod = '30d';

/** Ranges of the activity chart, which has its own switch. */
export const ANALYTICS_RANGES = ['7d', '30d', '90d'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const ANALYTICS_DEFAULT_TIMEZONE = 'Europe/Moscow';

/** Cached blocks live this long; `refresh=true` drops them earlier. */
export const ANALYTICS_CACHE_TTL_MS = 10 * 60 * 1000;
export const ANALYTICS_ATTENTION_CACHE_TTL_MS = 2 * 60 * 1000;
export const ANALYTICS_CACHE_PREFIX = 'analytics:';

// ------------------------------------------------------------------ queues
export const ANALYTICS_ACTIVITY_QUEUE = 'analytics-activity';
export const ANALYTICS_ACTIVITY_JOB = 'analytics.activity.seen';
export const ANALYTICS_LLM_USAGE_QUEUE = 'analytics-llm-usage';
export const ANALYTICS_LLM_USAGE_JOB = 'analytics.llm-usage.record';
export const ANALYTICS_RECORDS_QUEUE = 'analytics-records';
export const ANALYTICS_RECORDS_JOB = 'analytics.records.refresh';
/** Several imports in a row collapse into one records refresh. */
export const ANALYTICS_RECORDS_DELAY_MS = 30_000;
export const ANALYTICS_SNAPSHOT_QUEUE = 'analytics-snapshot';
export const ANALYTICS_SNAPSHOT_JOB = 'analytics.snapshot.daily';
/** Nightly, after the activity retention (02:15 UTC). */
export const ANALYTICS_SNAPSHOT_CRON = '30 0 * * *';
/** Days recomputed every night so late imports land in the right day. */
export const ANALYTICS_SNAPSHOT_RECOMPUTE_DAYS = 3;
export const ANALYTICS_SNAPSHOT_BATCH = 500;

// ---------------------------------------------------------------- activity
/** A user counts once per day and platform; the Redis key outlives the day. */
export const ANALYTICS_SEEN_TTL_SECONDS = 48 * 60 * 60;
export const ANALYTICS_PLATFORMS = ['ios', 'android', 'web'] as const;
export type AnalyticsPlatform = (typeof ANALYTICS_PLATFORMS)[number];

// -------------------------------------------------------------- thresholds
/** Days without a workout while a plan is active that mean the user may leave. */
export const CHURN_RISK_DAYS = 14;
export const CHURN_RISK_HIGH_DAYS = 21;
/** Acute to chronic load ratio above which the load grows too fast. */
export const OVERLOAD_RATIO = 1.5;
/** Days in a row the ratio stays high before an administrator is told. */
export const OVERLOAD_ATTENTION_DAYS = 7;
/** Share of overloaded athletes worth a warning on the dashboard. */
export const OVERLOAD_WARNING_SHARE = 0.1;
/** First workout within this many days of sign-up activates the user. */
export const ACTIVATION_DAYS = 14;
/** A habit: workouts in this many of the first 4 weeks. */
export const HABIT_WEEKS = 3;
export const SYNC_STALE_HOURS = 24;
export const NOTIFICATION_FAILURES_THRESHOLD = 3;
export const EXPORT_PENDING_HOURS = 1;
/** A goal at risk is worth attention when its date is this close. */
export const GOAL_AT_RISK_ATTENTION_DAYS = 28;
/** Window over which form growth is measured. */
export const FITNESS_WINDOW_WEEKS = 8;
/** Pace change within this many s/km counts as "no change". */
export const FITNESS_STABLE_PACE_SEC = 2;
/** Cohort table depth. */
export const COHORT_WEEKS = 12;
/** Longest plan week shown in adherence by plan week. */
export const PLAN_WEEKS_MAX = 30;

export const ATTENTION_TYPES = [
  'churn_risk',
  'overload_risk',
  'goal_at_risk',
  'integration_error',
  'sync_stale',
  'notification_failed',
  'export_pending',
  'export_failed',
] as const;
export type AttentionType = (typeof ATTENTION_TYPES)[number];
export const ATTENTION_SEVERITIES = ['high', 'medium', 'low'] as const;
export type AttentionSeverity = (typeof ATTENTION_SEVERITIES)[number];
export const ATTENTION_SORTS = ['severity', 'since'] as const;
export type AttentionSort = (typeof ATTENTION_SORTS)[number];

/** Sources of a completed workout as the dashboard groups them. */
export const WORKOUT_SOURCE_KEYS = ['trefix', 'strava', 'garmin', 'apple_health', 'health_connect', 'manual'] as const;
export type WorkoutSourceKey = (typeof WORKOUT_SOURCE_KEYS)[number];

export const FIRST_WORKOUT_BUCKETS = ['day1', 'days2_3', 'days4_7', 'days8_14', 'later', 'never'] as const;
export const RACE_RESULT_BUCKETS = ['faster_3plus', 'within_3', 'slower_3_10', 'slower_10plus'] as const;
export const PLAN_PROGRESS_BUCKETS = ['0_25', '25_50', '50_75', '75_100'] as const;

/** Precomputed daily metrics written by the nightly job. */
export const DAILY_METRICS = {
  DAU: 'dau',
  WAU: 'wau',
  MAU: 'mau',
  WAR: 'war',
  THRESHOLD_PACE_CHANGE: 'threshold_pace_change_median',
  FITNESS_CHANGE: 'fitness_change_median',
  OVERLOAD_SHARE: 'overload_risk_share',
  WEEKLY_KM_MEDIAN: 'weekly_km_median',
} as const;

// ---------------------------------------------------------------- realtime
/** Changes are pushed to the dashboard at most this often. */
export const ANALYTICS_REALTIME_THROTTLE_MS = 30_000;
export const ANALYTICS_REALTIME_QUEUE = 'analytics-realtime';
export const ANALYTICS_REALTIME_JOB = 'analytics.realtime.flush';
/** One pending flush at a time: BullMQ ignores a job whose id is already queued. */
export const ANALYTICS_REALTIME_JOB_ID = 'analytics-realtime-flush';
/** Version of the analytics data; part of every cache key, bumped on each flush. */
export const ANALYTICS_VERSION_KEY = 'analytics:version';

/** In-process events of the analytics module. */
export const ANALYTICS_EVENTS = {
  DATA_CHANGED: 'analytics.data_changed',
} as const;
