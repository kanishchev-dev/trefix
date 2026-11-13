import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { RedisService } from '@/common/redis/redis.service';

/** Redis backs sessions, queues and the cache: without it the API cannot serve requests. */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const client = this.redisService.getOrNil();
    try {
      const reply = client ? await client.ping() : null;
      const isHealthy = reply === 'PONG';
      const result = this.getStatus(key, isHealthy);
      if (!isHealthy) {
        throw new HealthCheckError('Redis ping failed', result);
      }
      return result;
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }
      throw new HealthCheckError('Redis ping failed', this.getStatus(key, false));
    }
  }
}
