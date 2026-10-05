import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { UserUpdatedEvent } from '../events/user-updated.event';

@Injectable()
export class UserUpdatedListener {
  private readonly logger = new Logger(UserUpdatedListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent('user.updated')
  handleUserUpdatedEvent(event: UserUpdatedEvent): void {
    this.logger.log(`Handling user.updated event for user: ${event.userId}`);
    this.realtimeService.emitToUser(event.userId, 'user.updated', event);
    this.realtimeService.emitToRoom('users', 'user.updated', event);
  }
}
