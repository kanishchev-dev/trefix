/**
 * Names of in-process domain events published by the integrations module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const INTEGRATIONS_EVENTS = {
  ACTIVITY_IMPORTED: 'integrations.activity_imported',
  ACTIVITY_MERGED: 'integrations.activity_merged',
  ACTIVITY_SOURCE_REMOVED: 'integrations.activity_source_removed',
  ACTIVITY_UPDATED: 'integrations.activity_updated',
  CONNECTED: 'integrations.connected',
  DISCONNECTED: 'integrations.disconnected',
  SYNC_BATCH_PROCESSED: 'integrations.sync_batch_processed',
  SYNC_COMPLETED: 'integrations.sync_completed',
  SOURCE_UNLINKED: 'integrations.source_unlinked',
  SYNC_REQUESTED: 'integrations.sync_requested',
} as const;

export type IntegrationsEventName = (typeof INTEGRATIONS_EVENTS)[keyof typeof INTEGRATIONS_EVENTS];
