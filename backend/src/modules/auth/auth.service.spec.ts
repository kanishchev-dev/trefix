import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';

import { hashPassword } from '@/common/utils/password-hash.util';
import { MailerService } from '@/modules/mailer/mailer.service';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';
import { UserInviteService } from '@/modules/users/services/user-invite.service';
import { UsersService } from '@/modules/users/users.service';

import { AuthService } from './auth.service';
import { AuthCodeService } from './services/auth-code.service';
import { AuthRedisService } from './services/auth-redis.service';
import { AuthSessionService } from './services/auth-session.service';
import { AuthSocialFlowService } from './services/auth-social-flow.service';
import { AuthTokenService } from './services/auth-token.service';
import { GeoIpService } from './services/geo-ip.service';
import { SocialIdentityService } from './services/social-identity.service';
import { UserIdentityService } from './services/user-identity.service';

async function createPasswordHash(password: string): Promise<string> {
  return hashPassword(password, 12);
}

describe('AuthService', () => {
  let service: AuthService;
  let sessions: AuthSessionService;
  let codes: AuthCodeService;

  const usersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    setEmailVerified: jest.fn(),
    updatePasswordHash: jest.fn(),
    updatePasswordAndVerification: jest.fn(),
  };

  const userInviteService = {
    consumeInviteCode: jest.fn(),
    clearInviteCode: jest.fn(),
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
    setEmailOtpCode: jest.fn(),
    getEmailOtpCode: jest.fn(),
    incrementEmailOtpAttempts: jest.fn(),
    clearEmailOtpCode: jest.fn(),
    isEmailOtpCooldownActive: jest.fn(),
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
        AuthSessionService,
        AuthCodeService,
        AuthSocialFlowService,
        { provide: UsersService, useValue: usersService },
        { provide: UserInviteService, useValue: userInviteService },
        { provide: AuthRedisService, useValue: authRedisService },
        { provide: AuthTokenService, useValue: authTokenService },
        { provide: MailerService, useValue: mailerService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: UserPermissionsService, useValue: permissionsService },
        SocialIdentityService,
        { provide: UserIdentityService, useValue: { resolveUser: jest.fn() } },
        { provide: GeoIpService, useValue: { lookup: jest.fn().mockReturnValue({ city: null, country: null }) } },
        { provide: ConfigService, useValue: configService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    sessions = module.get(AuthSessionService);
    codes = module.get(AuthCodeService);
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
    expect(result.user).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: false,
      }),
    );
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
    expect(result.user).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: true,
      }),
    );
  });

  it('activates an invited account, sets the password and returns tokens', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'invited@example.com',
      passwordHash: null,
      emailVerified: false,
    });
    userInviteService.consumeInviteCode.mockResolvedValue(true);
    usersService.updatePasswordAndVerification.mockResolvedValue({
      id: 'user-1',
      email: 'invited@example.com',
      emailVerified: true,
    });
    authTokenService.signRefreshToken.mockResolvedValue('refresh-token');
    authTokenService.signAccessToken.mockResolvedValue('access-token');
    authRedisService.createSession.mockResolvedValue(undefined);

    const result = await service.activateInvite({
      email: 'invited@example.com',
      code: '12345678',
      newPassword: 'StrongPass123!',
    });

    expect(userInviteService.consumeInviteCode).toHaveBeenCalledWith('user-1', '12345678');
    expect(usersService.updatePasswordAndVerification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ emailVerified: true, passwordHash: expect.any(String) }),
    );
    expect(result.tokens.accessToken).toBe('access-token');
    expect(eventEmitter.emit).toHaveBeenCalledWith('user.updated', expect.objectContaining({ userId: 'user-1' }));
  });

  it('rejects activation when the invite code is wrong', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'invited@example.com',
      passwordHash: null,
      emailVerified: false,
    });
    userInviteService.consumeInviteCode.mockResolvedValue(false);

    await expect(
      service.activateInvite({
        email: 'invited@example.com',
        code: '00000000',
        newPassword: 'StrongPass123!',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_INVITE_CODE_INVALID' });

    expect(usersService.updatePasswordAndVerification).not.toHaveBeenCalled();
  });

  it('rejects activation for an account that already has a password', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'invited@example.com',
      passwordHash: 'existing-hash',
      emailVerified: true,
    });

    await expect(
      service.activateInvite({
        email: 'invited@example.com',
        code: '12345678',
        newPassword: 'StrongPass123!',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_INVITE_ALREADY_ACTIVATED' });

    expect(userInviteService.consumeInviteCode).not.toHaveBeenCalled();
  });

  it('does not leak account existence for an unknown email', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.activateInvite({
        email: 'ghost@example.com',
        code: '12345678',
        newPassword: 'StrongPass123!',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_INVITE_CODE_INVALID' });
  });

  it('requests an email OTP code', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    authRedisService.isEmailOtpCooldownActive.mockResolvedValue(false);
    authRedisService.setEmailOtpCode.mockResolvedValue(undefined);
    mailerService.send.mockResolvedValue({ queued: false });

    const result = await codes.requestEmailOtpCode({
      email: 'otp@example.com',
    });

    expect(authRedisService.setEmailOtpCode).toHaveBeenCalledWith(
      'otp@example.com',
      expect.objectContaining({
        email: 'otp@example.com',
        codeHash: expect.any(String),
      }),
      expect.any(Number),
      expect.any(Number),
    );
    expect(mailerService.send).toHaveBeenCalled();
    expect(result.email).toBe('otp@example.com');
  });

  it('verifies an email OTP code and returns tokens', async () => {
    const codeHash = createHash('sha256').update('123456').digest('hex');
    authRedisService.getEmailOtpCode.mockResolvedValue({
      email: 'otp@example.com',
      codeHash,
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    authRedisService.incrementEmailOtpAttempts.mockResolvedValue(null);
    authRedisService.clearEmailOtpCode.mockResolvedValue(undefined);
    usersService.findByEmail.mockResolvedValue({
      id: 'user-otp',
      email: 'otp@example.com',
      passwordHash: null,
      emailVerified: false,
    });
    usersService.setEmailVerified.mockResolvedValue({
      id: 'user-otp',
      email: 'otp@example.com',
      passwordHash: null,
      emailVerified: true,
    });
    usersService.findOne.mockResolvedValue({
      id: 'user-otp',
      email: 'otp@example.com',
      passwordHash: null,
      emailVerified: true,
    });
    authTokenService.signRefreshToken.mockResolvedValue('refresh-token');
    authTokenService.signAccessToken.mockResolvedValue('access-token');
    authRedisService.createSession.mockResolvedValue(undefined);

    const result = await codes.verifyEmailOtpCode({
      email: 'otp@example.com',
      code: '123456',
    });

    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.user.email).toBe('otp@example.com');
  });

  describe('effective permissions in token responses', () => {
    // Regression: every endpoint that hands out tokens also has to hand out the
    // effective permission set. The frontend seeds its auth context from the
    // sign-in response and never asks again for the life of the page, so an
    // omitted `permissions` left it with an empty set — an almost empty sidebar
    // and denied access to every section, until a reload went through
    // `GET /auth/me`. Reload "fixing" it is what hid the bug for so long.
    const passwordHashFor = async (): Promise<string> => createPasswordHash('StrongPass123!');

    beforeEach(() => {
      permissionsService.getEffectivePermissions.mockResolvedValue(['users.read', 'users.update']);
    });

    it('includes permissions when a session is created by login', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: await passwordHashFor(),
        emailVerified: true,
      });
      authTokenService.signRefreshToken.mockResolvedValue('refresh-token');
      authTokenService.signAccessToken.mockResolvedValue('access-token');
      authRedisService.createSession.mockResolvedValue(undefined);

      const result = await service.login({
        email: 'user@example.com',
        password: 'StrongPass123!',
      });

      expect(result.permissions).toEqual(['users.read', 'users.update']);
    });

    it('includes permissions when the refresh token is rotated', async () => {
      authTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-1',
        sessionId: 'session-1',
        tokenType: 'refresh',
      });
      authRedisService.getSession.mockResolvedValue({
        sessionId: 'session-1',
        userId: 'user-1',
        refreshTokenHash: createHash('sha256').update('old-token').digest('hex'),
      });
      authRedisService.rotateSession.mockResolvedValue({ status: 'rotated' });
      usersService.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: true,
      });
      authTokenService.signRefreshToken.mockResolvedValue('next-token');
      authTokenService.signAccessToken.mockResolvedValue('next-access-token');

      const result = await sessions.refresh({ refreshToken: 'old-token' });

      expect(result.permissions).toEqual(['users.read', 'users.update']);
    });

    it('resolves permissions for the account rather than for the session holder', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-otp',
        email: 'otp@example.com',
        passwordHash: null,
        emailVerified: false,
      });
      authRedisService.getEmailOtpCode.mockResolvedValue({
        email: 'otp@example.com',
        codeHash: createHash('sha256').update('123456').digest('hex'),
        attempts: 0,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      authRedisService.incrementEmailOtpAttempts.mockResolvedValue(null);
      authRedisService.clearEmailOtpCode.mockResolvedValue(undefined);
      usersService.setEmailVerified.mockResolvedValue({
        id: 'user-otp',
        email: 'otp@example.com',
        passwordHash: null,
        emailVerified: true,
      });
      usersService.findOne.mockResolvedValue({
        id: 'user-otp',
        email: 'otp@example.com',
        passwordHash: null,
        emailVerified: true,
      });
      authTokenService.signRefreshToken.mockResolvedValue('refresh-token');
      authTokenService.signAccessToken.mockResolvedValue('access-token');
      authRedisService.createSession.mockResolvedValue(undefined);

      const result = await codes.verifyEmailOtpCode({
        email: 'otp@example.com',
        code: '123456',
      });

      expect(permissionsService.getEffectivePermissions).toHaveBeenCalledWith('user-otp');
      expect(result.permissions).toEqual(['users.read', 'users.update']);
    });
  });
});
