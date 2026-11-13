import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';

import type { RedisService } from '@/common/redis/redis.service';

import {
  ANALYTICS_EVENTS,
  ANALYTICS_REALTIME_JOB,
  ANALYTICS_REALTIME_JOB_ID,
  ANALYTICS_REALTIME_THROTTLE_MS,
  ANALYTICS_VERSION_KEY,
} from '../analytics.constants';
import { AnalyticsDataChangedEvent } from '../events/analytics-data-changed.event';
import { AnalyticsChangesService } from './analytics-changes.service';

type RedisMock = { get: jest.Mock; incr: jest.Mock };

function setup(redis: RedisMock | null = { get: jest.fn(), incr: jest.fn() }): {
  service: AnalyticsChangesService;
  queue: { add: jest.Mock };
  emitter: { emit: jest.Mock };
  redis: RedisMock | null;
} {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const emitter = { emit: jest.fn() };
  const redisService = {
    getOrNil: (): RedisMock | null => redis,
    getOrThrow: (): RedisMock => {
      if (!redis) throw new Error('no redis');
      return redis;
    },
  };
  const service = new AnalyticsChangesService(
    queue as unknown as Queue,
    redisService as unknown as RedisService,
    emitter as unknown as EventEmitter2,
  );
  return { service, queue, emitter, redis };
}

describe('AnalyticsChangesService', () => {
  it('folds changes into one delayed flush with a fixed job id', () => {
    const { service, queue } = setup();
    service.markChanged();
    service.markChanged();
    expect(queue.add).toHaveBeenCalledTimes(2);
    for (const call of queue.add.mock.calls) {
      expect(call[0]).toBe(ANALYTICS_REALTIME_JOB);
      expect(call[2]).toMatchObject({ jobId: ANALYTICS_REALTIME_JOB_ID, delay: ANALYTICS_REALTIME_THROTTLE_MS });
    }
  });

  it('never throws when the queue is unavailable', async () => {
    const { service, queue } = setup();
    queue.add.mockRejectedValueOnce(new Error('redis down'));
    expect(() => service.markChanged()).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('bumps the version and announces it on flush', async () => {
    const { service, emitter, redis } = setup();
    redis!.incr.mockResolvedValue(7);
    await expect(service.flush(new Date('2026-10-17T10:00:00Z'))).resolves.toBe(7);
    expect(redis!.incr).toHaveBeenCalledWith(ANALYTICS_VERSION_KEY);
    expect(emitter.emit).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.DATA_CHANGED,
      new AnalyticsDataChangedEvent(7, '2026-10-17T10:00:00.000Z'),
    );
  });

  it('reads version 0 without Redis or before the first change', async () => {
    await expect(setup(null).service.version()).resolves.toBe(0);
    const { service, redis } = setup();
    redis!.get.mockResolvedValue(null);
    await expect(service.version()).resolves.toBe(0);
    redis!.get.mockResolvedValue('12');
    await expect(service.version()).resolves.toBe(12);
  });
});
