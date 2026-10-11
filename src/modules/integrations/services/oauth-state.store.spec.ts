import { RedisService } from '@/common/redis/redis.service';

import { OAUTH_STATE_REDIS_PREFIX, OAUTH_STATE_TTL_MS } from '../constants/integrations.constants';
import { IntegrationStorageUnavailableException } from '../exceptions/integration-storage-unavailable.exception';
import { OAuthStateStore } from './oauth-state.store';

describe('OAuthStateStore', () => {
  const values = new Map<string, string>();
  const client = {
    set: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
      return 'OK';
    }),
    getdel: jest.fn(async (key: string) => {
      const value = values.get(key) ?? null;
      values.delete(key);
      return value;
    }),
  };
  const store = new OAuthStateStore({ getOrNil: () => client } as unknown as RedisService);

  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
  });

  it('issues a state with a TTL and lets it be consumed exactly once', async () => {
    const state = await store.issue({ athleteId: 'athlete-1', purpose: 'connect' });

    expect(client.set).toHaveBeenCalledWith(
      `${OAUTH_STATE_REDIS_PREFIX}${state}`,
      expect.any(String),
      'PX',
      OAUTH_STATE_TTL_MS,
    );
    await expect(store.consume(state)).resolves.toEqual({ athleteId: 'athlete-1', purpose: 'connect' });
    await expect(store.consume(state)).resolves.toBeNull();
  });

  it('rejects an empty state without touching Redis', async () => {
    await expect(store.consume('')).resolves.toBeNull();
    expect(client.getdel).not.toHaveBeenCalled();
  });

  it('reports a missing Redis connection as a domain error', async () => {
    const offline = new OAuthStateStore({ getOrNil: () => null } as unknown as RedisService);

    await expect(offline.issue({ athleteId: 'a', purpose: 'profile' })).rejects.toBeInstanceOf(
      IntegrationStorageUnavailableException,
    );
  });
});
