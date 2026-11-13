import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { UserBlockedEvent } from '@/modules/users/events/user-blocked.event';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { AuthRedisService } from '../services/auth-redis.service';
import { AuthSessionService } from '../services/auth-session.service';

/** Ends every session of a user who has just been blocked, unless the admin chose to keep them. */
@Injectable()
export class UserBlockedListener {
  constructor(
    private readonly authRedisService: AuthRedisService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @OnEvent(USERS_EVENTS.USER_BLOCKED, { async: true })
  async handle(event: UserBlockedEvent): Promise<void> {
    if (!event.revokeSessions) {
      return;
    }
    const revoked = await this.authRedisService.revokeUserSessions(event.userId);
    this.authSessionService.emitSessionRevokedEvents(revoked, 'blocked');
  }
}
