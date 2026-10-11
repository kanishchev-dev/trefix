import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { UserDeletedEvent } from '../events/user-deleted.event';

@Injectable()
export class UserDeletedListener {
  private readonly logger = new Logger(UserDeletedListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent(USERS_EVENTS.USER_DELETED)
  handleUserDeletedEvent(event: UserDeletedEvent): void {
    this.logger.log(`Handling user.deleted event for user: ${event.userId}`);
    this.realtimeService.emitToUser(event.userId, 'user.deleted', event);
    this.realtimeService.emitToRoom('users', 'user.deleted', event);
  }
}
