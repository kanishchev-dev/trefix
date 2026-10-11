import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  const config = {
    getOrThrow: (key: string): string =>
      ({
        'auth.accessTokenSecret': 'access-secret',
        'auth.refreshTokenSecret': 'refresh-secret',
        'auth.accessTokenExpiresIn': '15m',
        'auth.refreshTokenExpiresIn': '30d',
      })[key] ?? 'value',
    get: (): undefined => undefined,
  } as unknown as ConfigService;
  const service = new AuthTokenService(new JwtService({}), config);

  it('issues a distinct refresh token on every call, even within the same second', async () => {
    const first = await service.signRefreshToken('user-1', 'session-1');
    const second = await service.signRefreshToken('user-1', 'session-1');

    expect(first).not.toBe(second);
    await expect(service.verifyRefreshToken(second)).resolves.toEqual(
      expect.objectContaining({ sub: 'user-1', sessionId: 'session-1', tokenType: 'refresh' }),
    );
  });
});
