import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';

import { RedisService } from '@/common/redis/redis.service';

import { RealtimeService } from './realtime.service';

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => jest.fn()),
}));

describe('RealtimeService', () => {
  let service: RealtimeService;

  const mockRedisClient = {
    duplicate: jest.fn(),
  };

  const mockRedisService = {
    getOrNil: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRoomEmit = jest.fn().mockReturnValue(true);

  const mockServer = {
    emit: jest.fn().mockReturnValue(true),
    to: jest.fn().mockReturnValue({
      emit: mockRoomEmit,
    }),
    adapter: jest.fn(),
  } as unknown as Server;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisClient.duplicate.mockReset();
    mockRedisService.getOrNil.mockReset();
    mockConfigService.get.mockReset();

    mockRedisClient.duplicate.mockReturnValue({
      disconnect: jest.fn(),
    });
    mockRedisService.getOrNil.mockReturnValue(mockRedisClient);
    mockConfigService.get.mockReturnValue('test');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get(RealtimeService);
  });

  it('attaches the redis adapter and emits to a user room', () => {
    service.attachServer(mockServer);

    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(mockServer.adapter).toHaveBeenCalledTimes(1);

    const result = service.emitToUser('user-1', 'permission.updated', { id: 'perm-1' });

    expect(result).toBe(true);
    expect(mockServer.to).toHaveBeenCalledWith('user:user-1');
    expect(mockRoomEmit).toHaveBeenCalledWith(
      'permission.updated',
      expect.objectContaining({
        event: 'permission.updated',
        data: { id: 'perm-1' },
        meta: expect.objectContaining({
          audience: 'user',
          target: 'user-1',
          source: 'test',
        }),
      }),
    );
  });

  it('deduplicates user rooms when broadcasting to many users', () => {
    service.attachServer(mockServer);

    const result = service.emitToUsers(['user-1', 'user-1', 'user-2'], 'user.created', { id: 'u-1' });

    expect(result).toBe(true);
    expect(mockServer.to).toHaveBeenCalledWith(['user:user-1', 'user:user-2']);
  });
});
