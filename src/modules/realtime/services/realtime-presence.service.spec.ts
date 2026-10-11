import { Test, TestingModule } from '@nestjs/testing';

import { RedisService } from '@/common/redis/redis.service';

import {
  REALTIME_PRESENCE_EVENT,
  REALTIME_PRESENCE_REDIS_KEY,
  REALTIME_PRESENCE_TTL_MS,
} from '../constants/realtime.constants';
import { RealtimeService } from '../realtime.service';
import { RealtimePresenceService } from './realtime-presence.service';

/** Minimal in-memory stand-in for the sorted set presence lives in. */
class FakeRedis {
  readonly members = new Map<string, number>();
  readonly calls: string[] = [];

  multi(): FakeRedis {
    return this;
  }

  /** Chainable, like the real client: returns the pipeline, not a promise. */
  zadd(key: string, score: number, member: string): FakeRedis {
    this.calls.push(`zadd ${key} ${member}`);
    this.members.set(member, score);
    return this;
  }

  zrem(key: string, member: string): FakeRedis {
    this.calls.push(`zrem ${key} ${member}`);
    this.members.delete(member);
    return this;
  }

  zremrangebyscore(key: string, min: number, max: number): FakeRedis {
    this.calls.push(`zremrangebyscore ${key}`);

    for (const [member, score] of [...this.members.entries()]) {
      if (score >= min && score <= max) {
        this.members.delete(member);
      }
    }

    return this;
  }

  async zrangebyscore(_key: string, min: number, max: string): Promise<string[]> {
    const upper = max === '+inf' ? Number.POSITIVE_INFINITY : Number(max);

    return [...this.members.entries()].filter(([, score]) => score >= min && score <= upper).map(([member]) => member);
  }

  async exec(): Promise<unknown[]> {
    return [];
  }

  seed(userId: string, socketId: string, ageMs = 0): void {
    this.members.set(`${userId}:${socketId}`, Date.now() - ageMs);
  }
}

describe('RealtimePresenceService', () => {
  let service: RealtimePresenceService;
  let redis: FakeRedis;
  let realtimeService: { emitToRoom: jest.Mock };

  beforeEach(async () => {
    redis = new FakeRedis();
    realtimeService = { emitToRoom: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimePresenceService,
        {
          provide: RedisService,
          useValue: { getOrNil: () => redis },
        },
        {
          provide: RealtimeService,
          useValue: realtimeService,
        },
      ],
    }).compile();

    service = module.get<RealtimePresenceService>(RealtimePresenceService);
  });

  it('announces a user the first time a socket appears', async () => {
    await service.connect('user-1', 'socket-1');

    expect(realtimeService.emitToRoom).toHaveBeenCalledWith('users', REALTIME_PRESENCE_EVENT, {
      userId: 'user-1',
      online: true,
    });
  });

  it('stays quiet when a second tab opens for a user already online', async () => {
    await service.connect('user-1', 'socket-1');
    realtimeService.emitToRoom.mockClear();

    await service.connect('user-1', 'socket-2');

    expect(realtimeService.emitToRoom).not.toHaveBeenCalled();
  });

  it('announces the user as offline only after their last socket closes', async () => {
    await service.connect('user-1', 'socket-1');
    await service.connect('user-1', 'socket-2');
    realtimeService.emitToRoom.mockClear();

    await service.disconnect('user-1', 'socket-1');
    expect(realtimeService.emitToRoom).not.toHaveBeenCalled();

    await service.disconnect('user-1', 'socket-2');
    expect(realtimeService.emitToRoom).toHaveBeenCalledWith('users', REALTIME_PRESENCE_EVENT, {
      userId: 'user-1',
      online: false,
    });
  });

  /**
   * The whole point of scoring sockets by last-seen time: a backend that dies
   * without closing its sockets leaves members behind, and those users would
   * otherwise stay marked online forever.
   */
  it('ignores sockets that stopped being refreshed', async () => {
    redis.seed('user-1', 'socket-dead', REALTIME_PRESENCE_TTL_MS + 1_000);

    expect((await service.onlineAmong(['user-1'])).has('user-1')).toBe(false);
  });

  it('drops stale members on the next connection', async () => {
    redis.seed('user-1', 'socket-dead', REALTIME_PRESENCE_TTL_MS + 1_000);

    await service.connect('user-2', 'socket-1');

    expect(redis.members.has('user-1:socket-dead')).toBe(false);
  });

  it('answers only for the users that were asked about', async () => {
    redis.seed('user-1', 'socket-1');
    redis.seed('user-2', 'socket-1');

    const online = await service.onlineAmong(['user-1', 'user-404']);

    expect([...online]).toEqual(['user-1']);
  });

  it('reports nobody online without a Redis connection', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimePresenceService,
        { provide: RedisService, useValue: { getOrNil: () => null } },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    const degraded = module.get<RealtimePresenceService>(RealtimePresenceService);

    await degraded.connect('user-1', 'socket-1');
    expect(realtimeService.emitToRoom).not.toHaveBeenCalled();
    expect((await degraded.onlineAmong(['user-1'])).size).toBe(0);
  });

  it('stores sockets under the documented key', async () => {
    await service.connect('user-1', 'socket-1');

    expect(redis.calls[0]).toContain(REALTIME_PRESENCE_REDIS_KEY);
  });
});
