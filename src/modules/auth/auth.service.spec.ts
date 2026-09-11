import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { hashPassword } from '@/common/utils/password-hash.util';
import { MailerService } from '@/modules/mailer/mailer.service';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import { UsersService } from '@/modules/users/users.service';

import { AuthService } from './auth.service';
import { AuthRedisService } from './services/auth-redis.service';
import { AuthTokenService } from './services/auth-token.service';

async function createPasswordHash(password: string): Promise<string> {
  return hashPassword(password, 12);
}

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    setEmailVerified: jest.fn(),
    updatePasswordHash: jest.fn(),
  };

  const authRedisService = {
    createSession: jest.fn(),
    getSession: jest.fn(),
    rotateSession: jest.fn(),
    revokeSession: jest.fn(),
    revokeUserSessions: jest.fn(),
    setVerificationCode: jest.fn(),
    getVerificationCode: jest.fn(),
    incrementVerificationAttempts: jest.fn(),
    clearVerificationCode: jest.fn(),
    isVerificationCooldownActive: jest.fn(),
    setPasswordResetCode: jest.fn(),
    getPasswordResetCode: jest.fn(),
    incrementPasswordResetAttempts: jest.fn(),
    clearPasswordResetCode: jest.fn(),
  };

  const authTokenService = {
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    getAccessTokenTtlSeconds: jest.fn().mockReturnValue(900),
  };

  const mailerService = {
    send: jest.fn(),
  };

  const permissionsService = {
    getEffectivePermissions: jest.fn().mockResolvedValue([]),
  };

  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'auth.accessTokenSecret') return 'access-secret';
      if (key === 'auth.accessTokenExpiresIn') return '15m';
      if (key === 'auth.refreshTokenSecret') return 'refresh-secret';
      if (key === 'auth.refreshTokenExpiresIn') return '30d';
      if (key === 'auth.emailCodeExpiresIn') return '10m';
      if (key === 'auth.passwordResetExpiresIn') return '15m';
      if (key === 'auth.emailCodeResendCooldown') return '60s';
      return undefined;
    }),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: AuthRedisService, useValue: authRedisService },
        { provide: AuthTokenService, useValue: authTokenService },
        { provide: MailerService, useValue: mailerService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: ConfigService, useValue: configService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('registers a user and sends a verification code', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      emailVerified: false,
    });
    authRedisService.setVerificationCode.mockResolvedValue(undefined);
    mailerService.send.mockResolvedValue({ queued: false });

    const result = await service.register({
      email: 'user@example.com',
      password: 'StrongPass123!',
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        passwordHash: expect.any(String),
        emailVerified: false,
      }),
    );
    expect(authRedisService.setVerificationCode).toHaveBeenCalled();
    expect(mailerService.send).toHaveBeenCalled();
    expect(result.emailVerificationRequired).toBe(true);
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      emailVerified: false,
    });
  });

  it('logs in an email-verified user and returns tokens', async () => {
    const passwordHash = await createPasswordHash('StrongPass123!');
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash,
      emailVerified: true,
    });
    authTokenService.signRefreshToken.mockResolvedValue('refresh-token');
    authTokenService.signAccessToken.mockResolvedValue('access-token');
    authRedisService.createSession.mockResolvedValue(undefined);

    const result = await service.login({
      email: 'user@example.com',
      password: 'StrongPass123!',
    });

    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.tokens.refreshToken).toBe('refresh-token');
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      emailVerified: true,
      sessionId: expect.any(String),
    });
  });
});
