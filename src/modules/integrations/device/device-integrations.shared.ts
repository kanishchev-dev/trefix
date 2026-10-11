import { WEBHOOK_EVENT_STATUSES } from '../constants/integrations.constants';
import { DeviceBatchCounters } from '../entities/device-sync-batch.entity';
import { IngestOutcome } from '../ingestion/activity-ingestion.service';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const PENDING_STATUSES = [WEBHOOK_EVENT_STATUSES.PENDING, WEBHOOK_EVENT_STATUSES.PROCESSING];

export interface ProcessBatchJobData {
  batchId: string;
}

/** Device-side metadata kept in `integrations.metadata`. */
export interface DeviceMetadata {
  platform?: 'ios' | 'android';
  osVersion?: string;
  appVersion?: string;
  lastDeviceId?: string;
  historyDepthDays?: number;
  profileSync?: boolean;
  lastSync?: { syncId: string; syncType: string; counters: DeviceBatchCounters };
}

export function emptyCounters(): DeviceBatchCounters {
  return {
    created: 0,
    updated: 0,
    merged: 0,
    matchedPlanned: 0,
    matchedManual: 0,
    skipped: 0,
    rejected: 0,
    deleted: 0,
    failed: 0,
  };
}

export const OUTCOME_COUNTER: Record<IngestOutcome, keyof DeviceBatchCounters> = {
  created: 'created',
  updated: 'updated',
  merged: 'merged',
  matched_planned: 'matchedPlanned',
  matched_manual: 'matchedManual',
  skipped_own_record: 'skipped',
  skipped_origin_connected: 'skipped',
};
