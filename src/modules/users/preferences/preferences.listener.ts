import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { PreferencesUpdatedEvent } from './events/preferences-updated.event';

@Injectable()
export class PreferencesListener {
  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent('preferences.updated')
  handleUpdated(event: PreferencesUpdatedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'preferences.updated', event);
  }
}
