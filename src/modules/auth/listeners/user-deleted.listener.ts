import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { UserDeletedEvent } from '@/modules/users/events/user-deleted.event';

import { AuthSessionRevokedEvent } from '../events/auth-session-revoked.event';
import { AuthRedisService } from '../services/auth-redis.service';

@Injectable()
export class UserDeletedListener {
  constructor(
    private readonly authRedisService: AuthRedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('user.deleted')
  async handle(event: UserDeletedEvent): Promise<void> {
    const revokedSessions = await this.authRedisService.revokeUserSessions(event.userId);
    revokedSessions.forEach((session) => {
      this.eventEmitter.emit(
        'auth.session.revoked',
        new AuthSessionRevokedEvent(session.userId, session.sessionId, 'user-deleted'),
      );
    });
  }
}
