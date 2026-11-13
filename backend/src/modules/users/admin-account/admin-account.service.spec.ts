import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';

import { MailerService } from '@/modules/mailer/mailer.service';

import { AccountDeletionService } from '../account-deletion/account-deletion.service';
import { User } from '../entities/user.entity';
import { UserBlockedEvent, UserUnblockedEvent } from '../events/user-blocked.event';
import { UserPreferencesService } from '../preferences/user-preferences.service';
import { USERS_EVENTS } from '../users.events';
import { UsersService } from '../users.service';
import { AdminAccountService } from './admin-account.service';

const NOW = new Date('2026-10-16T10:00:00.000Z');
const ADMIN_ID = 'admin-1';
const USER_ID = 'user-1';

describe('AdminAccountService', () => {
  let service: AdminAccountService;
  let user: Record<string, unknown> & { update: jest.Mock };
  const usersService = { findOne: jest.fn(), findDisplayNames: jest.fn() };
  const userModel = { findByPk: jest.fn() };
  const deletion = { purgeAt: jest.fn() };
  const preferences = { getEntity: jest.fn() };
  const mailer = { send: jest.fn() };
  const i18n = { translate: jest.fn((key: string) => key) };
  const eventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    i18n.translate.mockImplementation((key: string) => key);
    user = {
      id: USER_ID,
      email: 'anna@example.com',
      isSystem: false,
      blockedAt: null,
      blockedUntil: null,
      update: jest.fn(async (values: Record<string, unknown>) => Object.assign(user, values)),
    };
    usersService.findOne.mockResolvedValue(user);
    preferences.getEntity.mockResolvedValue({ language: 'ru' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminAccountService,
        { provide: getModelToken(User), useValue: userModel },
        { provide: UsersService, useValue: usersService },
        { provide: AccountDeletionService, useValue: deletion },
        { provide: UserPreferencesService, useValue: preferences },
        { provide: MailerService, useValue: mailer },
        { provide: I18nService, useValue: i18n },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = moduleRef.get(AdminAccountService);
  });

  it('blocks until a date and ends sessions by default', async () => {
    const until = '2026-11-01T00:00:00.000Z';

    await service.block(ADMIN_ID, USER_ID, { reason: 'spam', comment: '  flood  ', until }, NOW);

    expect(user.update).toHaveBeenCalledWith({
      blockedAt: NOW,
      blockedUntil: new Date(until),
      blockedReason: 'spam',
      blockedComment: 'flood',
      blockedBy: ADMIN_ID,
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      USERS_EVENTS.USER_BLOCKED,
      new UserBlockedEvent(USER_ID, 'spam', new Date(until), true),
    );
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('emails the user when asked', async () => {
    await service.block(ADMIN_ID, USER_ID, { reason: 'other', notify: true, revokeSessions: false }, NOW);

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'anna@example.com', template: 'notifications/notification' }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      USERS_EVENTS.USER_BLOCKED,
      new UserBlockedEvent(USER_ID, 'other', null, false),
    );
  });

  it.each([
    ['the own account', { id: ADMIN_ID }, 'USER_BLOCK_FORBIDDEN'],
    ['a system account', { isSystem: true }, 'USER_BLOCK_FORBIDDEN'],
    ['a blocked account', { blockedAt: new Date('2026-10-01') }, 'USER_ALREADY_BLOCKED'],
  ])('refuses to block %s', async (_, overrides, code) => {
    Object.assign(user, overrides);

    await expect(service.block(ADMIN_ID, String(user.id), { reason: 'spam' }, NOW)).rejects.toMatchObject({ code });
    expect(user.update).not.toHaveBeenCalled();
  });

  it('refuses an end of block in the past', async () => {
    await expect(
      service.block(ADMIN_ID, USER_ID, { reason: 'spam', until: '2026-10-01T00:00:00.000Z' }, NOW),
    ).rejects.toMatchObject({ code: 'USER_BLOCK_UNTIL_INVALID' });
  });

  it('lifts a block', async () => {
    user.blockedAt = new Date('2026-10-01');

    await service.unblock(USER_ID);

    expect(user.update).toHaveBeenCalledWith(expect.objectContaining({ blockedAt: null, blockedBy: null }));
    expect(eventEmitter.emit).toHaveBeenCalledWith(USERS_EVENTS.USER_UNBLOCKED, new UserUnblockedEvent(USER_ID));
  });

  it('refuses to unblock an active account', async () => {
    await expect(service.unblock(USER_ID)).rejects.toMatchObject({ code: 'USER_NOT_BLOCKED' });
  });
});
