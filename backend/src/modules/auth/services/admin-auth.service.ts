import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DomainConflictException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { UsersService } from '@/modules/users/users.service';

import { AUTH_EVENTS } from '../auth.events';
import { normalizeEmail } from '../auth.helpers';
import { AuthIdentityResponseDto } from '../dto/auth-identity.dto';
import { AuthSessionResponseDto, toAuthSessionResponse } from '../dto/auth-session-response.dto';
import { AuthEmailChangedEvent } from '../events/auth-email-changed.event';
import { AuthEmailVerifiedEvent } from '../events/auth-email-verified.event';
import type { AuthSocialProvider } from '../interfaces/auth-social-provider.interface';
import { AuthCodeService } from './auth-code.service';
import { AuthRedisService } from './auth-redis.service';
import { AuthSessionService } from './auth-session.service';
import { UserIdentityService } from './user-identity.service';

/**
 * Sign-in and session management of any user from the admin panel. Uses the
 * same services as the user's own account screen, keyed by the target user.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authRedisService: AuthRedisService,
    private readonly authSessionService: AuthSessionService,
    private readonly authCodeService: AuthCodeService,
    private readonly userIdentityService: UserIdentityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Active sessions, most recently active first; `current` is always false for an admin view. */
  async listSessions(userId: string): Promise<AuthSessionResponseDto[]> {
    await this.usersService.findOne(userId);
    const sessions = await this.authRedisService.listUserSessions(userId);
    return sessions
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((session) => toAuthSessionResponse(session, ''));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.authRedisService.getSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new DomainNotFoundException('AUTH_SESSION_NOT_FOUND', 'Session is no longer active');
    }
    const revoked = await this.authRedisService.revokeSession(sessionId);
    this.authSessionService.emitSessionRevokedEvents(revoked ? [revoked] : [], 'revoked');
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.usersService.findOne(userId);
    await this.authSessionService.logoutAll(userId);
  }

  async listIdentities(userId: string): Promise<AuthIdentityResponseDto[]> {
    await this.usersService.findOne(userId);
    return this.userIdentityService.list(userId);
  }

  async unlinkIdentity(userId: string, provider: AuthSocialProvider): Promise<void> {
    await this.usersService.findOne(userId);
    await this.userIdentityService.unlink(userId, provider);
  }

  /** Sends the same reset code the user would get from the "forgot password" screen. */
  async sendPasswordReset(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    await this.authCodeService.requestPasswordReset({ email: user.email });
  }

  async verifyEmail(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (user.emailVerified) {
      return;
    }
    await this.usersService.setEmailVerified(userId, true);
    this.eventEmitter.emit(AUTH_EVENTS.EMAIL_VERIFIED, new AuthEmailVerifiedEvent(user.id, user.email));
  }

  /**
   * Replaces the email without a code from the old address: the new one stays
   * unverified until the user enters the code sent there.
   */
  async changeEmail(userId: string, email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const user = await this.usersService.findOne(userId);
    if (user.email === normalized) {
      return;
    }
    const owner = await this.usersService.findByEmail(normalized);
    if (owner && owner.id !== userId) {
      throw new DomainConflictException('EMAIL_TAKEN', 'This email belongs to another account');
    }
    const previousEmail = user.email;
    await this.usersService.changeEmail(userId, normalized);
    const updated = await this.usersService.setEmailVerified(userId, false);
    await this.authCodeService.issueVerificationCode(updated);
    this.eventEmitter.emit(AUTH_EVENTS.EMAIL_CHANGED, new AuthEmailChangedEvent(userId, previousEmail, normalized));
  }
}
