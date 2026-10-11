import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { UserInvitedEvent } from '../events/user-invited.event';

@Injectable()
export class UserInvitedListener {
  private readonly logger = new Logger(UserInvitedListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent(USERS_EVENTS.USER_INVITED)
  handleUserInvitedEvent(event: UserInvitedEvent): void {
    this.logger.log(`Handling user.invited event for user: ${event.email}`);
    this.realtimeService.emitToUser(event.userId, 'user.invited', event);
    this.realtimeService.emitToRoom('users', 'user.invited', event);
  }
}
