import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID } from 'crypto';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { MailerService } from '@/modules/mailer/mailer.service';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import {
  AUTH_DEFAULT_DISPLAY_NAME,
  AUTH_EMAIL_VERIFICATION_CODE_LENGTH,
  AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS,
  AUTH_EMAIL_VERIFICATION_TEMPLATE,
  AUTH_PASSWORD_HASH_ROUNDS,
  AUTH_PASSWORD_RESET_CODE_LENGTH,
  AUTH_PASSWORD_RESET_MAX_ATTEMPTS,
  AUTH_PASSWORD_RESET_TEMPLATE,
} from './auth.constants';
import { AuthRegisterResponseDto } from './dto/auth-register-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { AuthVerificationResponseDto } from './dto/auth-verification-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthEmailVerifiedEvent } from './events/auth-email-verified.event';
import { AuthPasswordChangedEvent } from './events/auth-password-changed.event';
import { AuthPasswordResetRequestedEvent } from './events/auth-password-reset-requested.event';
import { AuthRegisteredEvent } from './events/auth-registered.event';
import { AuthSessionCreatedEvent } from './events/auth-session-created.event';
import { AuthSessionRevokedEvent } from './events/auth-session-revoked.event';
import { AuthEmailAlreadyExistsException } from './exceptions/auth-email-already-exists.exception';
import { AuthEmailNotVerifiedException } from './exceptions/auth-email-not-verified.exception';
import { AuthInvalidCredentialsException } from './exceptions/auth-invalid-credentials.exception';
import { AuthPasswordResetCodeInvalidException } from './exceptions/auth-password-reset-code-invalid.exception';
import { AuthPasswordResetTokenExpiredException } from './exceptions/auth-password-reset-token-expired.exception';
import { AuthRefreshTokenReuseException } from './exceptions/auth-refresh-token-reuse.exception';
import { AuthSessionNotFoundException } from './exceptions/auth-session-not-found.exception';
import { AuthTokenInvalidException } from './exceptions/auth-token-invalid.exception';
import { AuthVerificationCodeInvalidException } from './exceptions/auth-verification-code-invalid.exception';
import { AuthVerificationCodeRateLimitException } from './exceptions/auth-verification-code-rate-limit.exception';
import { AuthCodeRecord } from './interfaces/auth-code-record.interface';
import { AuthSessionRecord } from './interfaces/auth-session.interface';
import { AuthTokenResult } from './interfaces/auth-token-result.interface';
import { AuthUserContext } from './interfaces/auth-user-context.interface';
import { AuthRedisService } from './services/auth-redis.service';
import { AuthTokenService } from './services/auth-token.service';
import { parseDurationToMilliseconds } from './utils/duration.util';

interface AuthenticatedUserResult {
  user: AuthUserContext;
  tokens: AuthTokenResult;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authRedisService: AuthRedisService,
    private readonly authTokenService: AuthTokenService,
    private readonly mailerService: MailerService,
    private readonly permissionsService: PermissionsService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto): Promise<AuthRegisterResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new AuthEmailAlreadyExistsException();
    }

    const passwordHash = await this.hashPassword(dto.password);
    const { firstName, lastName } = this.resolveRegistrationName(dto.email, dto.firstName, dto.lastName);

    const user = await this.usersService.create({
      email: dto.email,
      firstName,
      lastName,
      passwordHash,
      emailVerified: false,
    });

    await this.issueVerificationCode(user);
    this.eventEmitter.emit('auth.registered', new AuthRegisteredEvent(user.id, user.email));

    return {
      user: this.toAuthUserResponse(user),
      emailVerificationRequired: true,
    };
  }

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthenticatedUserResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new AuthInvalidCredentialsException();
    }

    const passwordMatches = await this.verifyPassword(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AuthInvalidCredentialsException();
    }

    if (!user.emailVerified) {
      throw new AuthEmailNotVerifiedException();
    }

    return this.createAuthenticatedSession(user, context);
  }

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

    const tokenHash = this.hashSecret(dto.refreshToken);
    const nextRefreshToken = await this.authTokenService.signRefreshToken(session.userId, session.sessionId);
    const nextRefreshTokenHash = this.hashSecret(nextRefreshToken);
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
      user: this.toAuthUserContext(user, session.sessionId),
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

    this.eventEmitter.emit('auth.session.revoked', new AuthSessionRevokedEvent(user.id, user.sessionId, 'logout'));
  }

  async logoutAll(userId: string): Promise<void> {
    const revokedSessions = await this.authRedisService.revokeUserSessions(userId);
    this.emitSessionRevokedEvents(revokedSessions, 'logout-all');
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthVerificationResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new AuthVerificationCodeInvalidException();
    }

    const record = await this.authRedisService.getVerificationCode(user.id);
    const isValid = await this.verifyCodeRecord(
      record,
      dto.code,
      () => this.authRedisService.incrementVerificationAttempts(user.id, AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS),
      () => this.authRedisService.clearVerificationCode(user.id),
    );

    if (!isValid) {
      throw new AuthVerificationCodeInvalidException();
    }

    const updatedUser = await this.usersService.setEmailVerified(user.id, true);
    this.eventEmitter.emit('auth.email_verified', new AuthEmailVerifiedEvent(updatedUser.id, updatedUser.email));

    return {
      user: this.toAuthUserResponse(updatedUser),
    };
  }

  async resendVerification(dto: ResendVerificationDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.emailVerified) {
      return;
    }

    if (await this.authRedisService.isVerificationCooldownActive(user.id)) {
      throw new AuthVerificationCodeRateLimitException();
    }

    await this.issueVerificationCode(user);
  }

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return;
    }

    const code = this.generateNumericCode(AUTH_PASSWORD_RESET_CODE_LENGTH);
    const record = this.buildCodeRecord(code, this.getPasswordResetTtlMilliseconds());

    await this.authRedisService.setPasswordResetCode(user.id, record, this.getPasswordResetTtlMilliseconds());
    await this.mailerService.send({
      to: user.email,
      subject: 'Reset your password',
      template: AUTH_PASSWORD_RESET_TEMPLATE,
      data: {
        code,
        expiresIn: Math.max(1, Math.ceil(this.getPasswordResetTtlMilliseconds() / 60000)),
      },
    });

    this.eventEmitter.emit('auth.password_reset_requested', new AuthPasswordResetRequestedEvent(user.id, user.email));
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new AuthPasswordResetTokenExpiredException();
    }

    const record = await this.authRedisService.getPasswordResetCode(user.id);
    const isValid = await this.verifyCodeRecord(
      record,
      dto.code,
      () => this.authRedisService.incrementPasswordResetAttempts(user.id, AUTH_PASSWORD_RESET_MAX_ATTEMPTS),
      () => this.authRedisService.clearPasswordResetCode(user.id),
    );

    if (!isValid) {
      throw new AuthPasswordResetCodeInvalidException();
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(user.id, passwordHash);

    const revokedSessions = await this.authRedisService.revokeUserSessions(user.id);
    this.emitSessionRevokedEvents(revokedSessions, 'password-reset');
    this.eventEmitter.emit('auth.password_changed', new AuthPasswordChangedEvent(user.id, user.email));
  }

  async changePassword(user: AuthUserContext, dto: ChangePasswordDto): Promise<AuthenticatedUserResult> {
    const currentUser = await this.usersService.findOne(user.id);
    if (!currentUser.passwordHash || !(await this.verifyPassword(dto.currentPassword, currentUser.passwordHash))) {
      throw new AuthInvalidCredentialsException();
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(currentUser.id, passwordHash);

    const revokedSessions = await this.authRedisService.revokeUserSessions(currentUser.id);
    this.emitSessionRevokedEvents(revokedSessions, 'password-change');

    return this.createAuthenticatedSession(await this.usersService.findOne(currentUser.id), {
      userAgent: undefined,
      ipAddress: undefined,
    });
  }

  async me(user: AuthUserContext): Promise<AuthUserResponseDto> {
    try {
      const currentUser = await this.usersService.findOne(user.id);
      const permissions = await this.permissionsService.getEffectivePermissions(currentUser.id);
      return this.toAuthUserResponse(currentUser, permissions);
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        throw new AuthSessionNotFoundException();
      }

      throw error;
    }
  }

  private async createAuthenticatedSession(
    user: User,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthenticatedUserResult> {
    const sessionId = randomUUID();
    const refreshToken = await this.authTokenService.signRefreshToken(user.id, sessionId);
    const refreshTokenHash = this.hashSecret(refreshToken);
    const session = this.buildSessionRecord(user, sessionId, refreshTokenHash, context);
    const ttlMilliseconds = this.getRefreshTokenTtlMilliseconds();

    await this.authRedisService.createSession(session, ttlMilliseconds);
    const accessToken = await this.authTokenService.signAccessToken(user.id, sessionId);

    this.eventEmitter.emit('auth.session.created', new AuthSessionCreatedEvent(user.id, sessionId));

    return {
      user: this.toAuthUserContext(user, sessionId),
      tokens: {
        accessToken,
        refreshToken,
        sessionId,
        accessTokenExpiresIn: this.authTokenService.getAccessTokenTtlSeconds(),
      },
    };
  }

  private async issueVerificationCode(user: User): Promise<void> {
    const code = this.generateNumericCode(AUTH_EMAIL_VERIFICATION_CODE_LENGTH);
    const ttlMilliseconds = this.getEmailVerificationTtlMilliseconds();
    const record = this.buildCodeRecord(code, ttlMilliseconds);

    await this.authRedisService.setVerificationCode(
      user.id,
      record,
      ttlMilliseconds,
      this.getVerificationCooldownMilliseconds(),
    );

    await this.mailerService.send({
      to: user.email,
      subject: 'Verify your email',
      template: AUTH_EMAIL_VERIFICATION_TEMPLATE,
      data: {
        code,
        expiresIn: Math.max(1, Math.ceil(ttlMilliseconds / 60000)),
      },
    });
  }

  private async verifyCodeRecord(
    record: AuthCodeRecord | null,
    code: string,
    incrementAttempts: () => Promise<AuthCodeRecord | null>,
    clearCode: () => Promise<void>,
  ): Promise<boolean> {
    if (!record) {
      return false;
    }

    const expectedHash = this.hashSecret(code);
    if (record.codeHash !== expectedHash) {
      const attemptsRecord = await incrementAttempts();
      if (!attemptsRecord) {
        await clearCode();
      }

      return false;
    }

    await clearCode();
    return true;
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

  private buildCodeRecord(code: string, ttlMilliseconds: number): AuthCodeRecord {
    const createdAt = new Date().toISOString();
    return {
      codeHash: this.hashSecret(code),
      attempts: 0,
      createdAt,
      expiresAt: new Date(Date.now() + ttlMilliseconds).toISOString(),
    };
  }

  private resolveRegistrationName(
    email: string,
    firstName?: string,
    lastName?: string,
  ): { firstName: string; lastName: string } {
    if (firstName || lastName) {
      return {
        firstName: firstName?.trim() || AUTH_DEFAULT_DISPLAY_NAME,
        lastName: lastName?.trim() || '',
      };
    }

    const localPart = email.split('@')[0] || AUTH_DEFAULT_DISPLAY_NAME;
    const normalizedLocalPart = localPart.replace(/[._-]+/g, ' ').trim();

    return {
      firstName: normalizedLocalPart || AUTH_DEFAULT_DISPLAY_NAME,
      lastName: '',
    };
  }

  private toAuthUserContext(user: User, sessionId: string): AuthUserContext {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      sessionId,
    };
  }

  private toAuthUserResponse(user: User, permissions?: string[]): AuthUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      permissions,
    };
  }

  private emitSessionRevokedEvents(sessions: AuthSessionRecord[], reason: AuthSessionRevokedEvent['reason']): void {
    sessions.forEach((session) => {
      this.eventEmitter.emit(
        'auth.session.revoked',
        new AuthSessionRevokedEvent(session.userId, session.sessionId, reason),
      );
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, AUTH_PASSWORD_HASH_ROUNDS);
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  private hashSecret(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private generateNumericCode(length: number): string {
    const upperBound = 10 ** length;
    return String(randomInt(0, upperBound)).padStart(length, '0');
  }

  private getEmailVerificationTtlMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.emailCodeExpiresIn'));
  }

  private getVerificationCooldownMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.emailCodeResendCooldown'));
  }

  private getPasswordResetTtlMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.passwordResetExpiresIn'));
  }

  private getRefreshTokenTtlMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.refreshTokenExpiresIn'));
  }
}
