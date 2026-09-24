export const INTEGRATION_PROVIDERS = ['strava', 'garmin', 'apple_health', 'health_connect'] as const;

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
