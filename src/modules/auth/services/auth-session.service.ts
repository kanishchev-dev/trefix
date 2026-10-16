import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';

import { DomainConflictException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { hashSecret } from '../auth.helpers';
import { AuthSessionResponseDto, toAuthSessionResponse } from '../dto/auth-session-response.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthSessionCreatedEvent } from '../events/auth-session-created.event';
import { AuthSessionRevokedEvent } from '../events/auth-session-revoked.event';
import { AuthRefreshTokenReuseException } from '../exceptions/auth-refresh-token-reuse.exception';
import { AuthSessionNotFoundException } from '../exceptions/auth-session-not-found.exception';
import { AuthTokenInvalidException } from '../exceptions/auth-token-invalid.exception';
import { AuthClientContext } from '../interfaces/auth-client-context.interface';
import { AuthSessionRecord } from '../interfaces/auth-session.interface';
import { AuthUserContext } from '../interfaces/auth-user-context.interface';
import { AuthenticatedUserResult } from '../interfaces/authenticated-user-result.interface';
import { parseDurationToMilliseconds } from '../utils/duration.util';
import { AuthRedisService } from './auth-redis.service';
import { AuthTokenService } from './auth-token.service';
import { GeoIpService } from './geo-ip.service';

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
    private readonly geoIpService: GeoIpService,
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

  /** Active sessions of the user, most recently active first. */
  async listSessions(user: AuthUserContext): Promise<AuthSessionResponseDto[]> {
    const sessions = await this.authRedisService.listUserSessions(user.id);
    return sessions
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((session) => toAuthSessionResponse(session, user.sessionId));
  }

  /** Ends one of the user's sessions; the current one is ended with `logout` instead. */
  async revokeSession(user: AuthUserContext, sessionId: string): Promise<void> {
    const session = await this.authRedisService.getSession(sessionId);
    if (!session || session.userId !== user.id) {
      // 404, not the 401 of an expired own session: the caller stays signed in.
      throw new DomainNotFoundException('AUTH_SESSION_NOT_FOUND', 'Session is no longer active');
    }
    if (sessionId === user.sessionId) {
      throw new DomainConflictException('AUTH_SESSION_CURRENT', 'Use logout to end the current session');
    }
    const revoked = await this.authRedisService.revokeSession(sessionId);
    this.emitSessionRevokedEvents(revoked ? [revoked] : [], 'revoked');
  }

  /** Signs out every device except the one making the request. */
  async logoutOthers(user: AuthUserContext): Promise<void> {
    const revoked = await this.authRedisService.revokeUserSessions(user.id, user.sessionId);
    this.emitSessionRevokedEvents(revoked, 'logout-others');
  }

  async createAuthenticatedSession(user: User, context: AuthClientContext): Promise<AuthenticatedUserResult> {
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
    context: AuthClientContext,
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
      deviceName: context.deviceName ?? null,
      platform: context.platform ?? null,
      appVersion: context.appVersion ?? null,
      ...this.geoIpService.lookup(context.ipAddress),
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
