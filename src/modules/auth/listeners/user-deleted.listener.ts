import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { UserDeletedEvent } from '@/modules/users/events/user-deleted.event';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { AuthSessionRevokedEvent } from '../events/auth-session-revoked.event';
import { AuthRedisService } from '../services/auth-redis.service';

@Injectable()
export class UserDeletedListener {
  constructor(
    private readonly authRedisService: AuthRedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(USERS_EVENTS.USER_DELETED)
  async handle(event: UserDeletedEvent): Promise<void> {
    const revokedSessions = await this.authRedisService.revokeUserSessions(event.userId);
    revokedSessions.forEach((session) => {
      this.eventEmitter.emit(
        AUTH_EVENTS.SESSION_REVOKED,
        new AuthSessionRevokedEvent(session.userId, session.sessionId, 'user-deleted'),
      );
    });
  }
}
