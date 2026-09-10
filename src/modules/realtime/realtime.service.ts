import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';

import { REALTIME_ROOM_PREFIX, REALTIME_USER_ROOM_PREFIX } from './constants/realtime.constants';
import { RealtimeEvent } from './interfaces/realtime-event.interface';

const DEFAULT_REALTIME_SOURCE = 'backend';

@Injectable()
export class RealtimeService implements OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeService.name);
  private server?: Server;
  private adapterBound = false;
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  attachServer(server: Server): void {
    this.server = server;

    if (this.adapterBound) {
      return;
    }

    const redisClient = this.redisService.getOrNil();
    if (!redisClient) {
      this.logger.warn('Redis client is not available. Realtime events will stay on the local instance.');
      return;
    }

    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    this.pubClient = pubClient;
    this.subClient = subClient;
    server.adapter(createAdapter(pubClient, subClient));
    this.adapterBound = true;

    this.logger.log('Realtime Redis adapter is attached.');
  }

  getUserRoom(userId: string): string {
    return `${REALTIME_USER_ROOM_PREFIX}${userId}`;
  }

  getRoom(room: string): string {
    return `${REALTIME_ROOM_PREFIX}${room}`;
  }

  emit<TData>(event: string, data: TData): boolean {
    return this.emitToAll(event, data);
  }

  emitToAll<TData>(event: string, data: TData): boolean {
    return this.emitToTargets((envelope) => this.server?.emit(event, envelope) ?? false, event, data, 'all');
  }

  emitToRoom<TData>(room: string, event: string, data: TData): boolean {
    return this.emitToTargets(
      (envelope) => this.server?.to(this.getRoom(room)).emit(event, envelope) ?? false,
      event,
      data,
      'room',
      room,
    );
  }

  emitToUser<TData>(userId: string, event: string, data: TData): boolean {
    return this.emitToTargets(
      (envelope) => this.server?.to(this.getUserRoom(userId)).emit(event, envelope) ?? false,
      event,
      data,
      'user',
      userId,
    );
  }

  emitToUsers<TData>(userIds: readonly string[], event: string, data: TData): boolean {
    const uniqueUserIds = [...new Set(userIds)].filter((userId) => userId.length > 0);

    if (uniqueUserIds.length === 0) {
      return false;
    }

    const rooms = uniqueUserIds.map((userId) => this.getUserRoom(userId));
    return this.emitToTargets(
      (envelope) => this.server?.to(rooms).emit(event, envelope) ?? false,
      event,
      data,
      'users',
      uniqueUserIds,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.pubClient ? this.closeRedisClient(this.pubClient) : Promise.resolve(),
      this.subClient ? this.closeRedisClient(this.subClient) : Promise.resolve(),
    ]);
  }

  private emitToTargets<TData>(
    dispatcher: (payload: RealtimeEvent<TData>) => boolean,
    event: string,
    data: TData,
    audience: 'all' | 'user' | 'users' | 'room',
    target?: string | string[],
  ): boolean {
    if (!this.server) {
      this.logger.warn(`Skipping realtime event "${event}" because the gateway is not ready yet.`);
      return false;
    }

    return dispatcher(this.buildEnvelope(event, data, audience, target));
  }

  private buildEnvelope<TData>(
    event: string,
    data: TData,
    audience: 'all' | 'user' | 'users' | 'room',
    target?: string | string[],
  ): RealtimeEvent<TData> {
    return {
      event,
      data,
      meta: {
        emittedAt: new Date().toISOString(),
        source: this.configService.get<string>('app.env') || DEFAULT_REALTIME_SOURCE,
        audience,
        target,
      },
    };
  }

  private async closeRedisClient(client: Redis): Promise<void> {
    try {
      client.disconnect();
    } catch (error) {
      this.logger.warn(`Failed to close realtime Redis client: ${(error as Error).message}`);
    }
  }
}
