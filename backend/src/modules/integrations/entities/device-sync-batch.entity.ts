import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { DeviceActivityRejectCode, DeviceSyncType } from '../constants/integrations.constants';
import { WEBHOOK_EVENT_STATUSES } from '../constants/integrations.constants';

/** A run as accepted from the app: validated, dates as ISO strings. */
export interface StoredDeviceActivity {
  sourceActivityId: string;
  type: string;
  startedAt: string;
  endedAt: string;
  utcOffsetMinutes: number | null;
  durationSec: number;
  elapsedTimeSec: number | null;
  distanceMeters: number;
  elevationGainMeters: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  cadence: number | null;
  calories: number | null;
  originAppId: string | null;
  originDevice: string | null;
}

export interface DeviceSyncBatchPayload {
  activities: StoredDeviceActivity[];
  deletedSourceActivityIds: string[];
  rejected: Array<{ sourceActivityId: string; code: DeviceActivityRejectCode }>;
}

export interface DeviceBatchCounters {
  created: number;
  updated: number;
  merged: number;
  matchedPlanned: number;
  matchedManual: number;
  skipped: number;
  rejected: number;
  deleted: number;
  failed: number;
}

export interface DeviceSyncBatchResult {
  counters: DeviceBatchCounters;
  failedSourceActivityIds: string[];
}

/** A batch of runs accepted from the app and processed asynchronously; the unique key makes resends idempotent. */
@Table({
  tableName: 'device_sync_batches',
  underscored: true,
})
export class DeviceSyncBatch extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'integration_id' })
  integrationId!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'sync_id' })
  syncId!: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'batch_index' })
  batchIndex!: number;

  @Column({ type: DataType.STRING(32), allowNull: false, field: 'sync_type' })
  syncType!: DeviceSyncType;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_last' })
  isLast!: boolean;

  @Column({ type: DataType.JSONB, allowNull: false })
  payload!: DeviceSyncBatchPayload;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: WEBHOOK_EVENT_STATUSES.PENDING })
  status!: (typeof WEBHOOK_EVENT_STATUSES)[keyof typeof WEBHOOK_EVENT_STATUSES];

  @Column({ type: DataType.JSONB, allowNull: true })
  result!: DeviceSyncBatchResult | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  error!: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  attempts!: number;

  @Column({ type: DataType.DATE, allowNull: true, field: 'processed_at' })
  processedAt!: Date | null;
}
