import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { hashSecret } from '../auth.helpers';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthSessionCreatedEvent } from '../events/auth-session-created.event';
import { AuthSessionRevokedEvent } from '../events/auth-session-revoked.event';
import { AuthRefreshTokenReuseException } from '../exceptions/auth-refresh-token-reuse.exception';
import { AuthSessionNotFoundException } from '../exceptions/auth-session-not-found.exception';
import { AuthTokenInvalidException } from '../exceptions/auth-token-invalid.exception';
import { AuthSessionRecord } from '../interfaces/auth-session.interface';
import { AuthUserContext } from '../interfaces/auth-user-context.interface';
import { AuthenticatedUserResult } from '../interfaces/authenticated-user-result.interface';
import { parseDurationToMilliseconds } from '../utils/duration.util';
import { AuthRedisService } from './auth-redis.service';
import { AuthTokenService } from './auth-token.service';

/**
 * Auth sessions: issuing token pairs, refresh rotation with reuse detection, logout.
 */
@Injectable()
export class AuthSessionService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authRedisService: AuthRedisService,
    private readonly authTokenService: AuthTokenService,
    private readonly userPermissionsService: UserPermissionsService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async refresh(dto: RefreshTokenDto): Promise<AuthenticatedUserResult> {
    let payload: Awaited<ReturnType<AuthTokenService['verifyRefreshToken']>>;
    try {
      payload = await this.authTokenService.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new AuthTokenInvalidException();
    }

    if (payload.tokenType !== 'refresh') {
      throw new AuthTokenInvalidException();
    }

    const session = await this.authRedisService.getSession(payload.sessionId);
    if (!session || session.userId !== payload.sub) {
      throw new AuthSessionNotFoundException();
    }

    const tokenHash = hashSecret(dto.refreshToken);
    const nextRefreshToken = await this.authTokenService.signRefreshToken(session.userId, session.sessionId);
    const nextRefreshTokenHash = hashSecret(nextRefreshToken);
    const ttlMilliseconds = this.getRefreshTokenTtlMilliseconds();

    const rotation = await this.authRedisService.rotateSession(
      session.sessionId,
      session.userId,
      tokenHash,
      nextRefreshTokenHash,
      ttlMilliseconds,
    );

    if (rotation.status === 'missing') {
      throw new AuthSessionNotFoundException();
    }

    if (rotation.status === 'reused') {
      const revokedSessions = await this.authRedisService.revokeUserSessions(session.userId);
      this.emitSessionRevokedEvents(
        [...(rotation.session ? [rotation.session] : []), ...revokedSessions],
        'refresh-reuse',
      );
      throw new AuthRefreshTokenReuseException();
    }

    let user: User;
    try {
      user = await this.usersService.findOne(session.userId);
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        await this.authRedisService.revokeSession(session.sessionId);
        throw new AuthSessionNotFoundException();
      }

      throw error;
    }

    const accessToken = await this.authTokenService.signAccessToken(user.id, session.sessionId);

    return {
      user,
      permissions: await this.userPermissionsService.getEffectivePermissions(user.id),
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        sessionId: session.sessionId,
        accessTokenExpiresIn: this.authTokenService.getAccessTokenTtlSeconds(),
      },
    };
  }

  async logout(user: AuthUserContext): Promise<void> {
    const session = await this.authRedisService.revokeSession(user.sessionId);
    if (!session) {
      return;
    }

    this.eventEmitter.emit(AUTH_EVENTS.SESSION_REVOKED, new AuthSessionRevokedEvent(user.id, user.sessionId, 'logout'));
  }

  async logoutAll(userId: string): Promise<void> {
    const revokedSessions = await this.authRedisService.revokeUserSessions(userId);
    this.emitSessionRevokedEvents(revokedSessions, 'logout-all');
  }

  async createAuthenticatedSession(
    user: User,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthenticatedUserResult> {
    const sessionId = randomUUID();
    const refreshToken = await this.authTokenService.signRefreshToken(user.id, sessionId);
    const refreshTokenHash = hashSecret(refreshToken);
    const session = this.buildSessionRecord(user, sessionId, refreshTokenHash, context);
    const ttlMilliseconds = this.getRefreshTokenTtlMilliseconds();

    await this.authRedisService.createSession(session, ttlMilliseconds);
    const accessToken = await this.authTokenService.signAccessToken(user.id, sessionId);

    this.eventEmitter.emit(AUTH_EVENTS.SESSION_CREATED, new AuthSessionCreatedEvent(user.id, sessionId));

    return {
      user,
      permissions: await this.userPermissionsService.getEffectivePermissions(user.id),
      tokens: {
        accessToken,
        refreshToken,
        sessionId,
        accessTokenExpiresIn: this.authTokenService.getAccessTokenTtlSeconds(),
      },
    };
  }

  private buildSessionRecord(
    user: User,
    sessionId: string,
    refreshTokenHash: string,
    context: { userAgent?: string; ipAddress?: string },
  ): AuthSessionRecord {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.getRefreshTokenTtlMilliseconds()).toISOString();

    return {
      sessionId,
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      refreshTokenHash,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };
  }

  toAuthUserContext(user: User, sessionId: string): AuthUserContext {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      sessionId,
    };
  }

  emitSessionRevokedEvents(sessions: AuthSessionRecord[], reason: AuthSessionRevokedEvent['reason']): void {
    sessions.forEach((session) => {
      this.eventEmitter.emit(
        AUTH_EVENTS.SESSION_REVOKED,
        new AuthSessionRevokedEvent(session.userId, session.sessionId, reason),
      );
    });
  }

  private getRefreshTokenTtlMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.refreshTokenExpiresIn'));
  }
}
