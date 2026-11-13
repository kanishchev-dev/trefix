import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

/** The shared ioredis client of the application. */
@Injectable()
export class RedisService implements OnApplicationShutdown {
  constructor(private readonly client: Redis) {}

  /** The client; `null` is kept for callers written against an optional connection. */
  getOrNil(): Redis | null {
    return this.client;
  }

  getOrThrow(): Redis {
    return this.client;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit().catch(() => this.client.disconnect());
    }
  }
}
