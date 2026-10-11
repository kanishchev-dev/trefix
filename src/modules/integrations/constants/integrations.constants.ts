export const OAUTH_PROVIDERS = ['strava', 'garmin'] as const;
export const DEVICE_PROVIDERS = ['apple_health', 'health_connect'] as const;
export const INTEGRATION_PROVIDERS = [...OAUTH_PROVIDERS, ...DEVICE_PROVIDERS] as const;

export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number];
export type DeviceProviderName = (typeof DEVICE_PROVIDERS)[number];
export type IntegrationProviderName = (typeof INTEGRATION_PROVIDERS)[number];

/** Runs recorded by the Trefix tracker on the phone. */
export const TRACKER_PROVIDER = 'trefix' as const;
/** Every source of activity records: connected services plus the in-app tracker. */
export const ACTIVITY_PROVIDERS = [...INTEGRATION_PROVIDERS, TRACKER_PROVIDER] as const;
export type ActivityProviderName = (typeof ACTIVITY_PROVIDERS)[number];

/** Providers whose activities are stored as `workout_sources`; other `workouts.source_provider` values mean manual/admin. */
export const IMPORTED_ACTIVITY_SOURCES: readonly string[] = ACTIVITY_PROVIDERS;

/**
 * Lower index wins when one run comes from several sources. A phone recording
 * yields to a watch: when both recorded the run, the watch is the primary record.
 */
export const ACTIVITY_SOURCE_PRIORITY: readonly ActivityProviderName[] = [
  'garmin',
  'strava',
  'apple_health',
  'health_connect',
  TRACKER_PROVIDER,
];

export const RECORDING_ENVIRONMENTS = ['outdoor', 'trail', 'treadmill'] as const;
export type RecordingEnvironment = (typeof RECORDING_ENVIRONMENTS)[number];
/** `mixed` — GPS with stretches counted by the pedometer while the signal was lost. */
export const DISTANCE_SOURCES = ['gps', 'pedometer', 'manual', 'mixed'] as const;
export type DistanceSource = (typeof DISTANCE_SOURCES)[number];
/** Distance sources measured by satellites; others do not count towards distance records. */
export const GPS_DISTANCE_SOURCES: readonly DistanceSource[] = ['gps', 'mixed'];

export const RECORDING_LIMITS = {
  maxDurationSec: 12 * 60 * 60,
  maxDistanceM: 200_000,
  minPaceSecPerKm: 150,
  maxPaceSecPerKm: 1200,
  maxTrackFileBytes: 5 * 1024 * 1024,
  maxRouteLineLength: 20_000,
  maxSplits: 250,
  maxLaps: 200,
  maxPauses: 500,
  maxNotesLength: 2000,
  /** A run started from a plan closes that workout only within this many days of its date. */
  plannedWorkoutDayTolerance: 1,
} as const;

/**
 * Apps that write runs into Apple Health / Health Connect on behalf of an
 * OAuth provider. While that provider is connected, its copies in Health are
 * skipped: the provider delivers the same run with more detail.
 */
export const HEALTH_ORIGIN_PROVIDER_MAP: Readonly<Record<string, OAuthProviderName>> = {
  'com.strava.stravaride': 'strava',
  'com.strava': 'strava',
  'com.garmin.connect.mobile': 'garmin',
  'com.garmin.android.apps.connectmobile': 'garmin',
};

/** Trefix's own app ids: records written by Trefix are never imported back. */
export const TREFIX_APP_IDS: readonly string[] = ['Kanishchev.Trefix'];

/** Two records are the same run when all three thresholds hold. */
export const ACTIVITY_DEDUP = {
  minOverlapRatio: 0.8,
  maxStartDiffSec: 10 * 60,
  maxDistanceDiffRatio: 0.05,
  maxDistanceDiffMeters: 300,
  /** Search window around the start for candidate sources. */
  candidateWindowSec: 6 * 60 * 60,
} as const;

/** A manually closed workout of the same day takes a device record when distances differ by no more than this. */
export const MANUAL_MATCH_MAX_DISTANCE_DIFF_RATIO = 0.15;

export const INTEGRATION_STATUSES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SYNCING: 'syncing',
  ERROR: 'error',
  REAUTHORIZATION_REQUIRED: 'reauthorization_required',
  DISCONNECTED: 'disconnected',
} as const;

export const SYNC_TYPES = {
  INITIAL: 'initial',
  WEBHOOK: 'webhook',
  MANUAL: 'manual',
  BACKFILL: 'backfill',
  FOREGROUND: 'foreground',
  BACKGROUND: 'background',
} as const;

export const SYNC_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const WEBHOOK_EVENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  FAILED: 'failed',
  IGNORED: 'ignored',
} as const;

export const INTEGRATIONS_QUEUE_NAME = 'integrations';
export const JOB_STRAVA_INITIAL_SYNC = 'strava.initial-sync';
export const JOB_STRAVA_PROCESS_WEBHOOK = 'strava.process-webhook';
export const JOB_STRAVA_FETCH_ACTIVITY = 'strava.fetch-activity';
export const JOB_STRAVA_PROFILE_SYNC = 'strava.profile-sync';
export const JOB_STRAVA_PROFILE_SYNC_ALL = 'strava.profile-sync-all';

/** Base scope: activity import. */
export const STRAVA_ACTIVITY_SCOPES = ['read', 'activity:read_all'] as const;
/** Extra scope for weight, sex and shoes of the athlete. */
export const STRAVA_PROFILE_SCOPE = 'profile:read_all';

// ---------------------------------------------------------------- device providers (Apple Health, Health Connect)

export const JOB_DEVICE_PROCESS_BATCH = 'device.process-batch';
export const JOB_DEVICE_BATCHES_CLEANUP = 'device.batches-cleanup';

/** The only platform each device provider works on. */
export const DEVICE_PROVIDER_PLATFORMS: Readonly<Record<DeviceProviderName, 'ios' | 'android'>> = {
  apple_health: 'ios',
  health_connect: 'android',
};

/** Normalized permissions the app reports after the system dialog (iOS: what was requested). */
export const DEVICE_SCOPES = [
  'workouts',
  'heart_rate',
  'distance',
  'elevation',
  'steps',
  'calories',
  'weight',
  'height',
  'resting_heart_rate',
  'history',
  'background',
] as const;
export type DeviceScope = (typeof DEVICE_SCOPES)[number];

export const DEVICE_SYNC_TYPES = ['initial', 'foreground', 'background', 'manual', 'backfill'] as const;
export type DeviceSyncType = (typeof DEVICE_SYNC_TYPES)[number];

export const DEVICE_SYNC_BATCH_MAX = 50;
export const DEVICE_SYNC_HISTORY_MAX_DAYS = 365;
export const DEVICE_SYNC_HISTORY_DEFAULT_DAYS = 180;
/** Accepted batches hold health data; processed ones are purged after this many days. */
export const DEVICE_BATCH_RETENTION_DAYS = 30;
export const DEVICE_SYNC_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;

/** Plausibility rules for a device run; a record outside them is rejected with a per-item code. */
export const DEVICE_ACTIVITY_LIMITS = {
  minDistanceMeters: 500,
  minDurationSec: 180,
  maxDurationSec: 86_400,
  futureToleranceSec: 300,
  fastestPaceSecPerKm: 150,
  slowestPaceSecPerKm: 900,
  heartRate: { min: 30, max: 240 },
  cadence: { min: 60, max: 260 },
} as const;

export const DEVICE_ACTIVITY_REJECT_CODES = [
  'ACTIVITY_NOT_RUNNING',
  'ACTIVITY_TOO_SHORT',
  'ACTIVITY_DURATION_INVALID',
  'ACTIVITY_IN_FUTURE',
  'ACTIVITY_TOO_OLD',
  'ACTIVITY_PACE_IMPLAUSIBLE',
  'ACTIVITY_TIME_RANGE_INVALID',
  'DUPLICATE_IN_BATCH',
] as const;
export type DeviceActivityRejectCode = (typeof DEVICE_ACTIVITY_REJECT_CODES)[number];

/** Resting HR of the profile = median of daily values over the latest days with data. */
export const RESTING_HR_MEDIAN_DAYS = 7;
export const RESTING_HR_MIN_DAYS = 3;
export const RESTING_HR_MAX_SAMPLES = 14;
/** Metrics measured longer ago than this are not applied to the profile. */
export const PROFILE_METRIC_MAX_AGE_DAYS = 90;

// ---------------------------------------------------------------- OAuth

/** Redis namespace of pending OAuth `state` values; one key per authorization attempt. */
export const OAUTH_STATE_REDIS_PREFIX = 'integrations:oauth-state:';
/** How long the user has to finish the provider's consent screen. */
export const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
/** An access token this close to expiry is refreshed before use. */
export const OAUTH_ACCESS_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
