import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import type { ConsentRevokedEvent } from '../../users/consents/events/consent.events';
import { DeviceIntegrationsService } from './device-integrations.service';
import { DeviceSyncBatchProcessedEvent, DeviceSyncCompletedEvent } from './device-sync.events';

@Injectable()
export class DeviceIntegrationsListener {
  private readonly logger = new Logger(DeviceIntegrationsListener.name);

  constructor(
    private readonly deviceService: DeviceIntegrationsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /** Awaited by the consent service: no health data is accepted after the revoke returns. */
  @OnEvent('users.consent_revoked', { promisify: true })
  async handleConsentRevoked(event: ConsentRevokedEvent): Promise<void> {
    if (event.type !== 'health_data') {
      return;
    }
    const disconnected = await this.deviceService.disconnectAllForUser(event.userId);
    this.logger.log(`Health consent revoked: ${disconnected} device integration(s) disconnected`);
  }

  @OnEvent('integrations.sync_batch_processed')
  handleBatchProcessed(event: DeviceSyncBatchProcessedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'integration.sync_progress', {
      provider: event.provider,
      syncId: event.syncId,
      batchIndex: event.batchIndex,
      counters: event.counters,
    });
  }

  @OnEvent('integrations.sync_completed')
  handleSyncCompleted(event: DeviceSyncCompletedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'integrations.sync_completed', {
      provider: event.provider,
      syncId: event.syncId,
      counters: event.counters,
    });
  }
}
