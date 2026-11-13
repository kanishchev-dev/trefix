import type { DeviceBatchCounters } from '../entities/device-sync-batch.entity';

/** `integrations.sync_batch_processed` */
export class DeviceSyncBatchProcessedEvent {
  constructor(
    public readonly userId: string,
    public readonly provider: string,
    public readonly syncId: string,
    public readonly batchIndex: number,
    public readonly counters: DeviceBatchCounters,
  ) {}
}

/** `integrations.sync_completed` */
export class DeviceSyncCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly athleteId: string,
    public readonly provider: string,
    public readonly syncId: string,
    public readonly counters: DeviceBatchCounters,
  ) {}
}
