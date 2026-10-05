import { RedisService } from '@liaoliaots/nestjs-redis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import appConfig from '@/config/app.config';
import { MailerService } from '@/modules/mailer/mailer.service';

import { User } from '../entities/user.entity';
import {
  USER_INVITE_ATTEMPTS_KEY_PREFIX,
  USER_INVITE_KEY_PREFIX,
  USER_INVITE_MAX_ATTEMPTS,
  USER_INVITE_TTL_SECONDS,
} from '../users.constants';
import { UserInviteService } from './user-invite.service';

describe('UserInviteService', () => {
  let service: UserInviteService;
  let redis: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
  };
  let mailerService: { send: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    passwordHash: null,
  } as unknown as User;

  beforeEach(async () => {
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    mailerService = { send: jest.fn().mockResolvedValue({ queued: false }) };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserInviteService,
        {
          provide: RedisService,
          useValue: { getOrNil: jest.fn().mockReturnValue(redis) },
        },
        { provide: MailerService, useValue: mailerService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: appConfig.KEY, useValue: { webAppUrl: 'https://admin.example.com' } },
      ],
    }).compile();

    service = module.get<UserInviteService>(UserInviteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('inviteUser', () => {
    it('should store the code hash with TTL and send the email', async () => {
      await service.inviteUser(mockUser);

      expect(redis.set).toHaveBeenCalledWith(
        `${USER_INVITE_KEY_PREFIX}${mockUser.id}`,
        expect.stringMatching(/^[a-f0-9]{64}$/),
        'EX',
        USER_INVITE_TTL_SECONDS,
      );

      expect(mailerService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          template: 'users/invite',
          data: expect.objectContaining({
            code: expect.stringMatching(/^\d{8}$/),
            activationUrl: expect.stringContaining(
              `https://admin.example.com/activate?email=${encodeURIComponent(mockUser.email)}`,
            ),
          }),
        }),
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith('user.invited', expect.objectContaining({ userId: mockUser.id }));
    });

    it('should reject inviting a user who already has a password', async () => {
      const userWithPassword = {
        ...mockUser,
        passwordHash: 'existing-hash',
      } as unknown as User;

      await expect(service.inviteUser(userWithPassword)).rejects.toThrow('User already has a password');

      expect(redis.set).not.toHaveBeenCalled();
      expect(mailerService.send).not.toHaveBeenCalled();
    });

    it('should fail when redis storage is unavailable', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UserInviteService,
          {
            provide: RedisService,
            useValue: { getOrNil: jest.fn().mockReturnValue(null) },
          },
          { provide: MailerService, useValue: mailerService },
          { provide: EventEmitter2, useValue: eventEmitter },
          { provide: appConfig.KEY, useValue: { webAppUrl: 'https://admin.example.com' } },
        ],
      }).compile();

      const isolatedService = module.get<UserInviteService>(UserInviteService);

      await expect(isolatedService.inviteUser(mockUser)).rejects.toThrow('Invite storage is unavailable');

      expect(mailerService.send).not.toHaveBeenCalled();
    });
  });

  describe('verifyInviteCode', () => {
    it('should accept the correct code and reject a wrong one', async () => {
      // Invite first to get a deterministic stored hash from the mocked set().
      await service.inviteUser(mockUser);
      const storedHash = redis.set.mock.calls[0][1] as string;

      redis.get.mockResolvedValue(storedHash);
      redis.set.mockClear();

      // Recover the plain code from the mailer payload.
      const sentCode = mailerService.send.mock.calls[0][0].data.code as string;

      redis.get.mockResolvedValue(storedHash);
      await expect(service.verifyInviteCode(mockUser.id, sentCode)).resolves.toBe(true);

      redis.get.mockResolvedValue(storedHash);
      await expect(service.verifyInviteCode(mockUser.id, '00000000')).resolves.toBe(false);
    });

    it('should return false when no invite is stored', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.verifyInviteCode(mockUser.id, '12345678')).resolves.toBe(false);
    });

    it('should return false when redis is unavailable', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UserInviteService,
          {
            provide: RedisService,
            useValue: { getOrNil: jest.fn().mockReturnValue(null) },
          },
          { provide: MailerService, useValue: mailerService },
          { provide: EventEmitter2, useValue: eventEmitter },
          { provide: appConfig.KEY, useValue: { webAppUrl: 'https://admin.example.com' } },
        ],
      }).compile();

      const isolatedService = module.get<UserInviteService>(UserInviteService);

      await expect(isolatedService.verifyInviteCode(mockUser.id, '12345678')).resolves.toBe(false);
    });
  });

  describe('consumeInviteCode', () => {
    async function issueCode(): Promise<string> {
      await service.inviteUser(mockUser);
      const storedHash = redis.set.mock.calls[0][1] as string;
      redis.get.mockResolvedValue(storedHash);
      return mailerService.send.mock.calls[0][0].data.code as string;
    }

    it('should consume the code on a correct attempt', async () => {
      const code = await issueCode();

      await expect(service.consumeInviteCode(mockUser.id, code)).resolves.toBe(true);
      expect(redis.del).toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    });

    it('should count a failed attempt without consuming the code', async () => {
      await issueCode();

      await expect(service.consumeInviteCode(mockUser.id, '00000000')).resolves.toBe(false);
      expect(redis.incr).toHaveBeenCalledWith(`${USER_INVITE_ATTEMPTS_KEY_PREFIX}${mockUser.id}`);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should drop the code after reaching the attempt limit', async () => {
      await issueCode();
      redis.incr.mockResolvedValue(USER_INVITE_MAX_ATTEMPTS);

      await expect(service.consumeInviteCode(mockUser.id, '00000000')).resolves.toBe(false);
      expect(redis.del).toHaveBeenCalledWith(
        `${USER_INVITE_KEY_PREFIX}${mockUser.id}`,
        `${USER_INVITE_ATTEMPTS_KEY_PREFIX}${mockUser.id}`,
      );
    });

    it('should return false when no invite is stored', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.consumeInviteCode(mockUser.id, '12345678')).resolves.toBe(false);
      expect(redis.incr).not.toHaveBeenCalled();
    });
  });

  describe('clearInviteCode', () => {
    it('should delete the stored invite key', async () => {
      await service.clearInviteCode(mockUser.id);

      expect(redis.del).toHaveBeenCalledWith(
        `${USER_INVITE_KEY_PREFIX}${mockUser.id}`,
        `${USER_INVITE_ATTEMPTS_KEY_PREFIX}${mockUser.id}`,
      );
    });

    it('should do nothing when redis is unavailable', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UserInviteService,
          {
            provide: RedisService,
            useValue: { getOrNil: jest.fn().mockReturnValue(null) },
          },
          { provide: MailerService, useValue: mailerService },
          { provide: EventEmitter2, useValue: eventEmitter },
          { provide: appConfig.KEY, useValue: { webAppUrl: 'https://admin.example.com' } },
        ],
      }).compile();

      const isolatedService = module.get<UserInviteService>(UserInviteService);

      await expect(isolatedService.clearInviteCode(mockUser.id)).resolves.toBeUndefined();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
