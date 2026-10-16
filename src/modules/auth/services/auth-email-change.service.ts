import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DomainConflictException } from '@/common/exceptions/domain-exceptions';
import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { MailerService } from '@/modules/mailer/mailer.service';
import { UsersService } from '@/modules/users/users.service';

import {
  AUTH_EMAIL_CHANGE_TEMPLATE,
  AUTH_EMAIL_VERIFICATION_CODE_LENGTH,
  AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS,
} from '../auth.constants';
import { generateNumericCode, hashSecret, normalizeEmail } from '../auth.helpers';
import { EmailChangeChallengeResponseDto } from '../dto/email-change.dto';
import { AuthEmailChangedEvent } from '../events/auth-email-changed.event';
import { AuthVerificationCodeInvalidException } from '../exceptions/auth-verification-code-invalid.exception';
import { AuthVerificationCodeRateLimitException } from '../exceptions/auth-verification-code-rate-limit.exception';
import { AuthUserContext } from '../interfaces/auth-user-context.interface';
import { parseDurationToMilliseconds } from '../utils/duration.util';
import { AuthRedisService } from './auth-redis.service';

/**
 * Changing the account email: a code goes to the new address and the email
 * changes only once that code is entered, so the user proves they own it.
 */
@Injectable()
export class AuthEmailChangeService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authRedisService: AuthRedisService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async request(user: AuthUserContext, rawEmail: string): Promise<EmailChangeChallengeResponseDto> {
    const email = normalizeEmail(rawEmail);
    if (email === normalizeEmail(user.email)) {
      throw new DomainConflictException('AUTH_EMAIL_UNCHANGED', 'This is already your email');
    }
    const owner = await this.usersService.findByEmail(email);
    if (owner && owner.id !== user.id) {
      throw new DomainConflictException('AUTH_EMAIL_ALREADY_EXISTS', 'A user with this email already exists');
    }
    if (await this.authRedisService.isEmailChangeCooldownActive(user.id)) {
      throw new AuthVerificationCodeRateLimitException();
    }

    const code = generateNumericCode(AUTH_EMAIL_VERIFICATION_CODE_LENGTH);
    const ttlMilliseconds = this.duration('auth.emailCodeExpiresIn');
    const cooldownMilliseconds = this.duration('auth.emailCodeResendCooldown');
    const now = Date.now();
    await this.authRedisService.setEmailChangeCode(
      user.id,
      {
        email,
        codeHash: hashSecret(code),
        attempts: 0,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttlMilliseconds).toISOString(),
      },
      ttlMilliseconds,
      cooldownMilliseconds,
    );
    await this.mailerService.send({
      to: email,
      subject: 'Confirm your new email',
      template: AUTH_EMAIL_CHANGE_TEMPLATE,
      data: { code, expiresIn: Math.max(1, Math.ceil(ttlMilliseconds / 60000)) },
    });

    return {
      email,
      expiresInSeconds: Math.max(1, Math.ceil(ttlMilliseconds / 1000)),
      resendAfterSeconds: Math.max(1, Math.ceil(cooldownMilliseconds / 1000)),
    };
  }

  /** Applies the change; other sessions keep working — they are tied to the user, not to the email. */
  async confirm(user: AuthUserContext, code: string): Promise<void> {
    const record = await this.authRedisService.getEmailChangeCode(user.id);
    if (!record) {
      throw new AuthVerificationCodeInvalidException();
    }
    if (record.codeHash !== hashSecret(code)) {
      const left = await this.authRedisService.incrementEmailChangeAttempts(
        user.id,
        AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS,
      );
      if (!left) {
        await this.authRedisService.clearEmailChangeCode(user.id);
      }
      throw new AuthVerificationCodeInvalidException();
    }
    await this.authRedisService.clearEmailChangeCode(user.id);
    const previousEmail = user.email;
    const updated = await this.usersService.changeEmail(user.id, record.email);
    this.eventEmitter.emit(
      AUTH_EVENTS.EMAIL_CHANGED,
      new AuthEmailChangedEvent(updated.id, previousEmail, updated.email),
    );
  }

  private duration(key: string): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>(key));
  }
}
