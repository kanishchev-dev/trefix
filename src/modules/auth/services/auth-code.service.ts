import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { MailerService } from '@/modules/mailer/mailer.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import {
  AUTH_EMAIL_OTP_TEMPLATE,
  AUTH_EMAIL_VERIFICATION_CODE_LENGTH,
  AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS,
  AUTH_EMAIL_VERIFICATION_TEMPLATE,
  AUTH_PASSWORD_RESET_CODE_LENGTH,
  AUTH_PASSWORD_RESET_MAX_ATTEMPTS,
  AUTH_PASSWORD_RESET_TEMPLATE,
} from '../auth.constants';
import {
  generateNumericCode,
  hashSecret,
  hashUserPassword,
  normalizeEmail,
  resolveRegistrationName,
  toAuthUserResponse,
} from '../auth.helpers';
import { AuthVerificationResponseDto } from '../dto/auth-verification-response.dto';
import { EmailOtpChallengeResponseDto } from '../dto/email-otp-challenge-response.dto';
import { EmailOtpRequestDto } from '../dto/email-otp-request.dto';
import { EmailOtpVerifyDto } from '../dto/email-otp-verify.dto';
import { PasswordResetConfirmDto } from '../dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from '../dto/password-reset-request.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { AuthEmailOtpRequestedEvent } from '../events/auth-email-otp-requested.event';
import { AuthEmailVerifiedEvent } from '../events/auth-email-verified.event';
import { AuthPasswordChangedEvent } from '../events/auth-password-changed.event';
import { AuthPasswordResetRequestedEvent } from '../events/auth-password-reset-requested.event';
import { AuthPasswordResetCodeInvalidException } from '../exceptions/auth-password-reset-code-invalid.exception';
import { AuthPasswordResetTokenExpiredException } from '../exceptions/auth-password-reset-token-expired.exception';
import { AuthVerificationCodeInvalidException } from '../exceptions/auth-verification-code-invalid.exception';
import { AuthVerificationCodeRateLimitException } from '../exceptions/auth-verification-code-rate-limit.exception';
import { AuthClientContext } from '../interfaces/auth-client-context.interface';
import { AuthCodeRecord } from '../interfaces/auth-code-record.interface';
import { AuthEmailOtpCodeRecord } from '../interfaces/auth-email-otp-code-record.interface';
import { AuthenticatedUserResult } from '../interfaces/authenticated-user-result.interface';
import { parseDurationToMilliseconds } from '../utils/duration.util';
import { AuthRedisService } from './auth-redis.service';
import { AuthSessionService } from './auth-session.service';

/**
 * One-time email codes: sign-in OTP, email verification and password reset.
 */
@Injectable()
export class AuthCodeService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authRedisService: AuthRedisService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async requestEmailOtpCode(dto: EmailOtpRequestDto): Promise<EmailOtpChallengeResponseDto> {
    const email = normalizeEmail(dto.email);
    if (await this.authRedisService.isEmailOtpCooldownActive(email)) {
      throw new AuthVerificationCodeRateLimitException();
    }

    const code = generateNumericCode(AUTH_EMAIL_VERIFICATION_CODE_LENGTH);
    const ttlMilliseconds = this.getEmailVerificationTtlMilliseconds();
    const record: AuthEmailOtpCodeRecord = {
      ...this.buildCodeRecord(code, ttlMilliseconds),
      email,
    };

    await this.authRedisService.setEmailOtpCode(
      email,
      record,
      ttlMilliseconds,
      this.getVerificationCooldownMilliseconds(),
    );

    await this.mailerService.send({
      to: email,
      subject: 'Your sign-in code',
      template: AUTH_EMAIL_OTP_TEMPLATE,
      data: {
        code,
        expiresIn: Math.max(1, Math.ceil(ttlMilliseconds / 60000)),
      },
    });

    this.eventEmitter.emit(
      AUTH_EVENTS.EMAIL_OTP_REQUESTED,
      new AuthEmailOtpRequestedEvent(email, Math.max(1, Math.ceil(ttlMilliseconds / 1000))),
    );

    return {
      email,
      expiresInSeconds: Math.max(1, Math.ceil(ttlMilliseconds / 1000)),
      resendAfterSeconds: Math.max(1, Math.ceil(this.getVerificationCooldownMilliseconds() / 1000)),
    };
  }

  async verifyEmailOtpCode(dto: EmailOtpVerifyDto, context: AuthClientContext = {}): Promise<AuthenticatedUserResult> {
    const email = normalizeEmail(dto.email);
    const record = await this.authRedisService.getEmailOtpCode(email);

    const isValid = await this.verifyCodeRecord(
      record,
      dto.code,
      () => this.authRedisService.incrementEmailOtpAttempts(email, AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS),
      () => this.authRedisService.clearEmailOtpCode(email),
    );

    if (!isValid) {
      throw new AuthVerificationCodeInvalidException();
    }

    const user = await this.resolveOrCreateEmailOtpUser(email);
    if (!user.emailVerified) {
      await this.usersService.setEmailVerified(user.id, true);
    }

    const currentUser = await this.usersService.findOne(user.id);
    this.eventEmitter.emit(AUTH_EVENTS.EMAIL_VERIFIED, new AuthEmailVerifiedEvent(currentUser.id, currentUser.email));

    return this.authSessionService.createAuthenticatedSession(currentUser, context);
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
    this.eventEmitter.emit(AUTH_EVENTS.EMAIL_VERIFIED, new AuthEmailVerifiedEvent(updatedUser.id, updatedUser.email));

    return {
      user: toAuthUserResponse(updatedUser),
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

    const code = generateNumericCode(AUTH_PASSWORD_RESET_CODE_LENGTH);
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

    this.eventEmitter.emit(
      AUTH_EVENTS.PASSWORD_RESET_REQUESTED,
      new AuthPasswordResetRequestedEvent(user.id, user.email),
    );
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

    const passwordHash = await hashUserPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(user.id, passwordHash);

    const revokedSessions = await this.authRedisService.revokeUserSessions(user.id);
    this.authSessionService.emitSessionRevokedEvents(revokedSessions, 'password-reset');
    this.eventEmitter.emit(AUTH_EVENTS.PASSWORD_CHANGED, new AuthPasswordChangedEvent(user.id, user.email));
  }

  async issueVerificationCode(user: User): Promise<void> {
    const code = generateNumericCode(AUTH_EMAIL_VERIFICATION_CODE_LENGTH);
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

  private async resolveOrCreateEmailOtpUser(email: string): Promise<User> {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      return existingUser;
    }

    const { firstName, lastName } = resolveRegistrationName(email);
    return this.usersService.create({
      email,
      firstName,
      lastName,
      emailVerified: true,
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

    const expectedHash = hashSecret(code);
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

  private buildCodeRecord(code: string, ttlMilliseconds: number): AuthCodeRecord {
    const createdAt = new Date().toISOString();
    return {
      codeHash: hashSecret(code),
      attempts: 0,
      createdAt,
      expiresAt: new Date(Date.now() + ttlMilliseconds).toISOString(),
    };
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
}
