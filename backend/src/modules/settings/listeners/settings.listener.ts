import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';
import { SETTINGS_EVENTS } from '@/modules/settings/settings.events';

import { SettingsUpdatedEvent } from '../events/settings-updated.event';
import { SETTINGS_REALTIME_EVENT, SETTINGS_ROOM } from '../settings.constants';

@Injectable()
export class SettingsListener {
  private readonly logger = new Logger(SettingsListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * Broadcasts settings changes to every connected admin client so the
   * UI (theme, locale, defaults) reacts without a manual refresh.
   */
  @OnEvent(SETTINGS_EVENTS.UPDATED)
  handleSettingsUpdated(event: SettingsUpdatedEvent): void {
    this.logger.log('Global settings updated; broadcasting realtime event');
    this.realtimeService.emitToRoom(SETTINGS_ROOM, SETTINGS_REALTIME_EVENT, event);
  }
}
