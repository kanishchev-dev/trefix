import { ConfigService } from '@nestjs/config';

import { encryptToken } from '@/common/utils/encryption.util';

import { Integration } from '../entities/integration.entity';
import { StravaProvider } from '../providers/strava/strava.provider';
import { StravaTokenService } from './strava-token.service';

const KEY = 'test-integrations-encryption-key-32-chars!!';
const HOUR_MS = 60 * 60 * 1000;

function integrationRow(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int-1',
    accessTokenEncrypted: encryptToken('old-access', KEY),
    refreshTokenEncrypted: encryptToken('old-refresh', KEY),
    accessTokenExpiresAt: new Date(Date.now() - 1000),
    save: jest.fn(),
    ...overrides,
  } as unknown as Integration;
}

describe('StravaTokenService — access token refresh', () => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let lockedRow: Integration;
  let integrationModel: { findByPk: jest.Mock; sequelize: { transaction: jest.Mock } };
  let stravaProvider: { refreshToken: jest.Mock };
  let service: StravaTokenService;

  beforeEach(() => {
    lockedRow = integrationRow();
    integrationModel = {
      findByPk: jest.fn(async () => lockedRow),
      sequelize: { transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(transaction)) },
    };
    stravaProvider = {
      refreshToken: jest.fn().mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: new Date(Date.now() + 6 * HOUR_MS),
      }),
    };
    const config = { getOrThrow: jest.fn().mockReturnValue(KEY) };
    service = new StravaTokenService(
      integrationModel as unknown as typeof Integration,
      stravaProvider as unknown as StravaProvider,
      config as unknown as ConfigService,
    );
  });

  it('refreshes an expired token under a row lock and hands it to the caller', async () => {
    const integration = integrationRow();

    await service.ensureValidAccessToken(integration);

    expect(integrationModel.findByPk).toHaveBeenCalledWith('int-1', { transaction, lock: 'UPDATE' });
    expect(stravaProvider.refreshToken).toHaveBeenCalledWith('old-refresh');
    expect(lockedRow.save).toHaveBeenCalledWith({ transaction });
    expect(integration.accessTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('reuses a token another job refreshed while this one waited for the lock', async () => {
    lockedRow = integrationRow({ accessTokenExpiresAt: new Date(Date.now() + 6 * HOUR_MS) });
    const integration = integrationRow();

    await service.ensureValidAccessToken(integration);

    expect(stravaProvider.refreshToken).not.toHaveBeenCalled();
    expect(integration.refreshTokenEncrypted).toBe(lockedRow.refreshTokenEncrypted);
  });

  it('does nothing while the token is still fresh', async () => {
    await service.ensureValidAccessToken(integrationRow({ accessTokenExpiresAt: new Date(Date.now() + HOUR_MS) }));

    expect(integrationModel.sequelize.transaction).not.toHaveBeenCalled();
  });
});
