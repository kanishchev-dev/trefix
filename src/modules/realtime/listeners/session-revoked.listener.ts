import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AuthSessionRevokedEvent } from '@/modules/auth/events/auth-session-revoked.event';

import { RealtimeService } from '../realtime.service';

/**
 * Keeps realtime connections tied to the lifetime of their session.
 *
 * The gateway checks the session once, at connect time. Without this a socket
 * opened before a logout would keep receiving admin events until the client
 * happened to reconnect, long after the session itself was gone.
 */
@Injectable()
export class SessionRevokedListener {
  private readonly logger = new Logger(SessionRevokedListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent('auth.session.revoked')
  handleSessionRevoked(event: AuthSessionRevokedEvent): void {
    const disconnected = this.realtimeService.disconnectSession(event.sessionId);

    this.logger.log(
      `Realtime sockets for session ${event.sessionId} dropped (${event.reason})${
        disconnected ? '' : ' — gateway not ready'
      }`,
    );
  }
}