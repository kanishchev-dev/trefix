import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DeviceConnectionsService } from '@/modules/integrations/device/device-connections.service';
import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { USERS_EVENTS } from '@/modules/users/users.events';

import type { ConsentRevokedEvent } from '../../users/consents/events/consent.events';
import { DeviceSyncBatchProcessedEvent, DeviceSyncCompletedEvent } from './device-sync.events';

@Injectable()
export class DeviceIntegrationsListener {
  private readonly logger = new Logger(DeviceIntegrationsListener.name);

  constructor(
    private readonly deviceConnections: DeviceConnectionsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /** Awaited by the consent service: no health data is accepted after the revoke returns. */
  @OnEvent(USERS_EVENTS.CONSENT_REVOKED, { promisify: true })
  async handleConsentRevoked(event: ConsentRevokedEvent): Promise<void> {
    if (event.type !== 'health_data') {
      return;
    }
    const disconnected = await this.deviceConnections.disconnectAllForUser(event.userId);
    this.logger.log(`Health consent revoked: ${disconnected} device integration(s) disconnected`);
  }

  @OnEvent(INTEGRATIONS_EVENTS.SYNC_BATCH_PROCESSED)
  handleBatchProcessed(event: DeviceSyncBatchProcessedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'integration.sync_progress', {
      provider: event.provider,
      syncId: event.syncId,
      batchIndex: event.batchIndex,
      counters: event.counters,
    });
  }

  @OnEvent(INTEGRATIONS_EVENTS.SYNC_COMPLETED)
  handleSyncCompleted(event: DeviceSyncCompletedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'integrations.sync_completed', {
      provider: event.provider,
      syncId: event.syncId,
      counters: event.counters,
    });
  }
}
