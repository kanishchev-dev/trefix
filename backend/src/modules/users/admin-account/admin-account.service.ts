import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { I18nService } from 'nestjs-i18n';

import {
  DomainBadRequestException,
  DomainConflictException,
  DomainNotFoundException,
} from '@/common/exceptions/domain-exceptions';
import { MailerService } from '@/modules/mailer/mailer.service';

import { AccountDeletionService } from '../account-deletion/account-deletion.service';
import { User } from '../entities/user.entity';
import { UserBlockedEvent, UserUnblockedEvent } from '../events/user-blocked.event';
import { UserPreferencesService } from '../preferences/user-preferences.service';
import { isUserBlocked, resolveUserStatus } from '../user-status';
import { USERS_EVENTS } from '../users.events';
import { UsersService } from '../users.service';
import { AccountSecurityResponseDto, BlockUserDto } from './admin-account.dto';

/** Mails to a user without a language in the app go out in the product's primary language. */
const MAIL_FALLBACK_LANGUAGE = 'ru';
const NOTIFICATION_TEMPLATE = 'notifications/notification';

/** Account status and blocking from the admin panel. */
@Injectable()
export class AdminAccountService {
  private readonly logger = new Logger(AdminAccountService.name);

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly usersService: UsersService,
    private readonly accountDeletionService: AccountDeletionService,
    private readonly preferencesService: UserPreferencesService,
    private readonly mailerService: MailerService,
    private readonly i18n: I18nService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Works for deleted accounts too, so the admin panel can show and restore them. */
  async getSecurity(userId: string): Promise<AccountSecurityResponseDto> {
    const user = await this.userModel.findByPk(userId, { paranoid: false });
    if (!user) {
      throw new DomainNotFoundException('USER_NOT_FOUND', `User ${userId} not found`);
    }
    const blocked = isUserBlocked(user);
    const names = blocked && user.blockedBy ? await this.usersService.findDisplayNames([user.blockedBy]) : new Map();

    return {
      status: resolveUserStatus(user),
      block:
        blocked && user.blockedAt
          ? {
              at: user.blockedAt,
              until: user.blockedUntil,
              reason: user.blockedReason,
              comment: user.blockedComment,
              by: user.blockedBy ? { id: user.blockedBy, name: names.get(user.blockedBy) ?? null } : null,
            }
          : null,
      email: user.email,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordChangedAt: user.passwordChangedAt,
      hasPassword: Boolean(user.passwordHash),
      deletion: user.deletedAt
        ? { deletedAt: user.deletedAt, purgeAt: await this.accountDeletionService.purgeAt(user.id) }
        : null,
      isSystem: user.isSystem,
    };
  }

  async block(actorUserId: string, userId: string, dto: BlockUserDto, now = new Date()): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (user.isSystem || user.id === actorUserId) {
      throw new DomainConflictException(
        'USER_BLOCK_FORBIDDEN',
        'System accounts and your own account cannot be blocked',
      );
    }
    if (isUserBlocked(user, now)) {
      throw new DomainConflictException('USER_ALREADY_BLOCKED', 'The account is already blocked');
    }
    const until = dto.until ? new Date(dto.until) : null;
    if (until && until.getTime() <= now.getTime()) {
      throw new DomainBadRequestException('USER_BLOCK_UNTIL_INVALID', 'The end of the block must be in the future');
    }

    await user.update({
      blockedAt: now,
      blockedUntil: until,
      blockedReason: dto.reason,
      blockedComment: dto.comment?.trim() || null,
      blockedBy: actorUserId,
    });
    this.eventEmitter.emit(
      USERS_EVENTS.USER_BLOCKED,
      new UserBlockedEvent(user.id, dto.reason, until, dto.revokeSessions ?? true),
    );

    if (dto.notify) {
      await this.notifyBlocked(user, until);
    }
  }

  async unblock(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!isUserBlocked(user)) {
      throw new DomainConflictException('USER_NOT_BLOCKED', 'The account is not blocked');
    }
    await user.update({
      blockedAt: null,
      blockedUntil: null,
      blockedReason: null,
      blockedComment: null,
      blockedBy: null,
    });
    this.eventEmitter.emit(USERS_EVENTS.USER_UNBLOCKED, new UserUnblockedEvent(user.id));
  }

  /** A failed email does not undo the block; it is logged for a retry by hand. */
  private async notifyBlocked(user: User, until: Date | null): Promise<void> {
    try {
      const lang = (await this.preferencesService.getEntity(user.id)).language ?? MAIL_FALLBACK_LANGUAGE;
      const t = (key: string, args: Record<string, unknown> = {}): string =>
        this.i18n.translate(`users.MAILS.ACCOUNT_BLOCKED.${key}`, { lang, args }) as string;
      const untilText = until
        ? new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(until)
        : null;
      await this.mailerService.send({
        to: user.email,
        subject: t('SUBJECT'),
        template: NOTIFICATION_TEMPLATE,
        data: {
          title: t('TITLE'),
          message: untilText ? t('MESSAGE_UNTIL', { until: `${untilText} UTC` }) : t('MESSAGE'),
        },
      });
    } catch (error) {
      this.logger.error(`Cannot email the block notice to user ${user.id}: ${(error as Error).message}`);
    }
  }
}
