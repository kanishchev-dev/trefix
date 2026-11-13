import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash, randomInt } from 'crypto';
import Redis from 'ioredis';

import { DomainConflictException, DomainUnavailableException } from '@/common/exceptions/domain-exceptions';
import { RedisService } from '@/common/redis/redis.service';
import appConfig from '@/config/app.config';
import { MailerService } from '@/modules/mailer/mailer.service';
import { User } from '@/modules/users/entities/user.entity';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { UserInvitedEvent } from '../events/user-invited.event';
import {
  USER_INVITE_ATTEMPTS_KEY_PREFIX,
  USER_INVITE_CODE_LENGTH,
  USER_INVITE_KEY_PREFIX,
  USER_INVITE_MAX_ATTEMPTS,
  USER_INVITE_TTL_SECONDS,
} from '../users.constants';

/**
 * Handles the admin invite flow: generates a one-time activation code,
 * persists its hash in Redis and emails it to the invited user.
 */
@Injectable()
export class UserInviteService {
  private readonly logger = new Logger(UserInviteService.name);
  private readonly redis: Redis | null;

  constructor(
    redisService: RedisService,
    private readonly mailerService: MailerService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
  ) {
    this.redis = redisService.getOrNil();
  }

  /**
   * Sends an activation invite to a user without a password.
   * @param user - Invited user
   * @throws DomainException when the user already has a password
   */
  async inviteUser(user: User): Promise<void> {
    if (user.passwordHash) {
      throw new DomainConflictException('USER_INVITE_NOT_ALLOWED', 'User already has a password and cannot be invited');
    }

    if (!this.redis) {
      throw new DomainUnavailableException('USER_INVITE_UNAVAILABLE', 'Invite storage is unavailable');
    }

    const code = this.generateNumericCode(USER_INVITE_CODE_LENGTH);
    const codeHash = this.hashSecret(code);

    await this.redis.set(`${USER_INVITE_KEY_PREFIX}${user.id}`, codeHash, 'EX', USER_INVITE_TTL_SECONDS);

    const activationUrl = this.buildActivationUrl(user.email, code);

    await this.mailerService.send({
      to: user.email,
      subject: 'Activate your Trefix account',
      template: 'users/invite',
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        code,
        activationUrl,
        expiresIn: Math.max(1, Math.ceil(USER_INVITE_TTL_SECONDS / 3600)),
      },
    });

    this.eventEmitter.emit(USERS_EVENTS.USER_INVITED, new UserInvitedEvent(user.id, user.email));
    this.logger.log(`Invite sent to ${user.email}`);
  }

  /**
   * Verifies an invite code for a user without consuming it.
   * @param userId - Invited user id
   * @param code - Activation code from the email
   * @returns True when the code matches
   */
  async verifyInviteCode(userId: string, code: string): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    const storedHash = await this.redis.get(`${USER_INVITE_KEY_PREFIX}${userId}`);
    if (!storedHash) {
      return false;
    }

    return storedHash === this.hashSecret(code);
  }

  /**
   * Verifies an invite code and consumes it atomically on success.
   *
   * Failed attempts are counted per user; once the limit is reached the
   * stored code is dropped so the invite has to be reissued by an admin.
   * @param userId - Invited user id
   * @param code - Activation code from the email
   * @returns True when the code matched and was consumed
   */
  async consumeInviteCode(userId: string, code: string): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    const storedHash = await this.redis.get(`${USER_INVITE_KEY_PREFIX}${userId}`);
    if (!storedHash) {
      return false;
    }

    if (storedHash !== this.hashSecret(code)) {
      await this.registerFailedAttempt(userId);
      return false;
    }

    await this.clearInviteCode(userId);
    return true;
  }

  /**
   * Consumes the stored invite code after successful activation.
   * @param userId - Invited user id
   */
  async clearInviteCode(userId: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    await this.redis.del(`${USER_INVITE_KEY_PREFIX}${userId}`, `${USER_INVITE_ATTEMPTS_KEY_PREFIX}${userId}`);
  }

  private async registerFailedAttempt(userId: string): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      return;
    }

    const attemptsKey = `${USER_INVITE_ATTEMPTS_KEY_PREFIX}${userId}`;

    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      await redis.expire(attemptsKey, USER_INVITE_TTL_SECONDS);
    }

    if (attempts >= USER_INVITE_MAX_ATTEMPTS) {
      this.logger.warn(`Invite code for user ${userId} locked after ${attempts} failed attempts`);
      await this.clearInviteCode(userId);
    }
  }

  /**
   * Builds the admin link that pre-fills the public activation screen.
   */
  private buildActivationUrl(email: string, code: string): string {
    const baseUrl = this.appConfiguration.webAppUrl;
    const query = new URLSearchParams({ email, code }).toString();
    return `${baseUrl}/activate?${query}`;
  }

  private generateNumericCode(length: number): string {
    const upperBound = 10 ** length;
    return String(randomInt(0, upperBound)).padStart(length, '0');
  }

  private hashSecret(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
