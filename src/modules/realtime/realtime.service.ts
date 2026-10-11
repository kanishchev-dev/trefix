import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';

import {
  REALTIME_ROOM_PREFIX,
  REALTIME_SESSION_ROOM_PREFIX,
  REALTIME_USER_ROOM_PREFIX,
} from './constants/realtime.constants';
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

    const adapterHost = typeof server.adapter === 'function' ? server : (server as Server & { server?: Server }).server;
    if (typeof adapterHost?.adapter !== 'function') {
      this.logger.warn(
        'Realtime Redis adapter is not available on the gateway server object. Running without Redis pub/sub.',
      );
      return;
    }

    adapterHost.adapter(createAdapter(pubClient, subClient));
    this.adapterBound = true;

    this.logger.log('Realtime Redis adapter is attached.');
  }

  getUserRoom(userId: string): string {
    return `${REALTIME_USER_ROOM_PREFIX}${userId}`;
  }

  getRoom(room: string): string {
    return `${REALTIME_ROOM_PREFIX}${room}`;
  }

  getSessionRoom(sessionId: string): string {
    return `${REALTIME_SESSION_ROOM_PREFIX}${sessionId}`;
  }

  /**
   * Drops every socket opened by a revoked session.
   *
   * Goes through the session room rather than an in-memory socket list, so it
   * also reaches connections held by other backend instances — the Redis
   * adapter propagates the command to them.
   */
  disconnectSession(sessionId: string): boolean {
    if (!this.server) {
      return false;
    }

    this.server.in(this.getSessionRoom(sessionId)).disconnectSockets(true);
    return true;
  }

  emit<TData>(event: string, data: TData): boolean {
    return this.emitToAll(event, data);
  }

  emitToAll<TData>(event: string, data: TData): boolean {
    return this.emitToTargets((envelope) => this.server?.emit(event, envelope) ?? false, event, data, 'all');
  }

  emitToRoom<TData>(room: string, event: string, data: TData): boolean {
    const socketRoom = this.getRoom(room);

    this.warnWhenNobodyListens(event, socketRoom);

    return this.emitToTargets(
      (envelope) => this.server?.to(socketRoom).emit(event, envelope) ?? false,
      event,
      data,
      'room',
      room,
    );
  }

  /**
   * Warns when an event is published to a room nobody is in.
   *
   * A silent emit is the failure mode this whole pipeline is built to avoid:
   * the socket reports "connected", nothing arrives, and the only symptom is a
   * UI that looks frozen until somebody reloads. With this in the log, the
   * distinction between "no client subscribed" and "the client ignored the
   * event" is answerable without a debugger.
   */
  private warnWhenNobodyListens(event: string, socketRoom: string): void {
    const rooms = this.adapterRooms();

    if (!rooms) {
      return;
    }

    if ((rooms.get(socketRoom)?.size ?? 0) === 0) {
      this.logger.warn(`Realtime event "${event}" targets room "${socketRoom}", which has no subscribers.`);
    }
  }

  /**
   * Room membership of the adapter currently in use.
   *
   * The gateway hands over either the root server or a namespace server, and
   * those two expose the adapter differently: on the root it is a getter
   * function, on a namespace a plain property. Reading it the wrong way returns
   * `undefined` and, worse, a stray throw here would abort the emit and swallow
   * the event this check exists to diagnose.
   */
  private adapterRooms(): Map<string, Set<unknown>> | undefined {
    const server = this.server as
      ({ adapter?: unknown; server?: { adapter?: unknown } } & Record<string, unknown>) | undefined;

    if (!server) {
      return undefined;
    }

    const host =
      typeof server.adapter === 'function'
        ? server
        : ((server.server?.adapter ? server.server : server) as Record<string, unknown>);

    const adapter = typeof host.adapter === 'function' ? host.adapter() : host.adapter;

    const rooms = (adapter as { rooms?: Map<string, Set<unknown>> } | undefined)?.rooms;

    return rooms instanceof Map ? rooms : undefined;
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
