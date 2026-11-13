import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { MailerService } from '@/modules/mailer/mailer.service';
import { UsersService } from '@/modules/users/users.service';

import { hashSecret } from '../auth.helpers';
import { AuthEmailChangeService } from './auth-email-change.service';
import { AuthRedisService } from './auth-redis.service';

const user = { id: 'user-1', email: 'old@example.com', emailVerified: true, sessionId: 'session-1' };

describe('AuthEmailChangeService', () => {
  let redis: Record<string, jest.Mock>;
  let usersService: { findByEmail: jest.Mock; changeEmail: jest.Mock };
  let mailer: { send: jest.Mock };
  let service: AuthEmailChangeService;

  beforeEach(() => {
    redis = {
      isEmailChangeCooldownActive: jest.fn().mockResolvedValue(false),
      setEmailChangeCode: jest.fn(),
      getEmailChangeCode: jest.fn(),
      incrementEmailChangeAttempts: jest.fn().mockResolvedValue({ attempts: 1 }),
      clearEmailChangeCode: jest.fn(),
    };
    usersService = { findByEmail: jest.fn().mockResolvedValue(null), changeEmail: jest.fn() };
    mailer = { send: jest.fn() };
    service = new AuthEmailChangeService(
      usersService as unknown as UsersService,
      redis as unknown as AuthRedisService,
      mailer as unknown as MailerService,
      { getOrThrow: jest.fn((key: string) => (key.endsWith('Cooldown') ? '60s' : '10m')) } as unknown as ConfigService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
  });

  it('sends the code to the new address, not the current one', async () => {
    await service.request(user, ' New@Example.com ');

    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'new@example.com' }));
    expect(redis.setEmailChangeCode).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ email: 'new@example.com' }),
      600_000,
      60_000,
    );
  });

  it('rejects an email taken by another account', async () => {
    usersService.findByEmail.mockResolvedValue({ id: 'user-2' });

    await expect(service.request(user, 'taken@example.com')).rejects.toMatchObject({
      code: 'AUTH_EMAIL_ALREADY_EXISTS',
    });
  });

  it('changes the email only with the right code', async () => {
    redis.getEmailChangeCode.mockResolvedValue({ email: 'new@example.com', codeHash: hashSecret('1234'), attempts: 0 });
    usersService.changeEmail.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

    await expect(service.confirm(user, '9999')).rejects.toMatchObject({ code: 'AUTH_VERIFICATION_CODE_INVALID' });
    expect(usersService.changeEmail).not.toHaveBeenCalled();

    await service.confirm(user, '1234');
    expect(usersService.changeEmail).toHaveBeenCalledWith('user-1', 'new@example.com');
  });
});
