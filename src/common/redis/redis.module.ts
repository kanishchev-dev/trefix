import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { RedisService } from './redis.service';

/**
 * One ioredis connection shared by auth, realtime, OAuth state, invites and
 * the health check. Cache and queues open their own connections.
 */
@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): RedisService =>
        new RedisService(
          new Redis({
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: Number(configService.get<number>('REDIS_PORT') || 6379),
          }),
        ),
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
