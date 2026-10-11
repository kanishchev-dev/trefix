import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import {
  REALTIME_PRESENCE_EVENT,
  REALTIME_PRESENCE_REDIS_KEY,
  REALTIME_PRESENCE_TTL_MS,
} from '../constants/realtime.constants';
import { RealtimeService } from '../realtime.service';

/**
 * Room the presence change is published to.
 *
 * Reusing `users` avoids a room whose only purpose is to carry "somebody came
 * online", and means anyone who may read the user list already receives it.
 */
const PRESENCE_ROOM = 'users';

export interface RealtimePresenceUpdatedEvent {
  readonly userId: string;
  readonly online: boolean;
}

/**
 * Tracks which users currently hold a live socket.
 *
 * Presence is derived from the sockets themselves rather than a flag on the
 * user row: a connection that dies without a clean close — a crashed backend, a
 * closed laptop, a suspended tab — leaves no trace to clean up, because the
 * score simply stops being refreshed and the socket ages out of the window.
 */
@Injectable()
export class RealtimePresenceService {
  private readonly logger = new Logger(RealtimePresenceService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Records a socket and announces the user if this is their first one.
   *
   * Only the transition is published: a second tab opening the admin is not a
   * state change, and refreshing every row on screen for it would be noise.
   */
  async connect(userId: string, socketId: string): Promise<void> {
    const client = this.getClient();

    if (!client) {
      return;
    }

    const member = this.buildMember(userId, socketId);
    const wasOnline = await this.hasLiveSocket(client, userId);

    await client
      .multi()
      .zadd(REALTIME_PRESENCE_REDIS_KEY, Date.now(), member)
      // Members that stopped being refreshed are dead; dropping them here keeps
      // the set from growing across restarts without a separate sweeper.
      .zremrangebyscore(REALTIME_PRESENCE_REDIS_KEY, 0, this.expiredBefore())
      .exec();

    if (!wasOnline) {
      this.publish(userId, true);
    }
  }

  /**
   * Records a heartbeat for a live socket.
   *
   * Refreshes the score and re-checks membership: a user can leave while still
   * holding a socket that is technically open (a revoked session whose event
   * was lost, say), and the periodic re-read is what eventually marks them
   * offline.
   */
  async touch(userId: string, socketId: string): Promise<void> {
    const client = this.getClient();

    if (!client) {
      return;
    }

    await client.zadd(REALTIME_PRESENCE_REDIS_KEY, Date.now(), this.buildMember(userId, socketId));
  }

  /** Drops a socket and announces the user once their last one closed. */
  async disconnect(userId: string, socketId: string): Promise<void> {
    const client = this.getClient();

    if (!client) {
      return;
    }

    await client.zrem(REALTIME_PRESENCE_REDIS_KEY, this.buildMember(userId, socketId));

    const stillOnline = await this.hasLiveSocket(client, userId);

    if (!stillOnline) {
      this.publish(userId, false);
    }
  }

  /**
   * Which of the given users currently hold a socket.
   *
   * Answers for a supplied list rather than "everyone online" so the endpoint
   * cannot be turned into a directory of who is active in the admin right now.
   */
  async onlineAmong(userIds: readonly string[]): Promise<Set<string>> {
    const client = this.getClient();
    const uniqueUserIds = [...new Set(userIds.filter((userId) => userId.length > 0))];

    if (!client || uniqueUserIds.length === 0) {
      return new Set();
    }

    const wanted = new Set(uniqueUserIds);
    const online = new Set<string>();

    const members = await client.zrangebyscore(REALTIME_PRESENCE_REDIS_KEY, this.expiredBefore(), '+inf');

    for (const member of members) {
      const userId = this.parseMemberUserId(member);

      if (userId && wanted.has(userId)) {
        online.add(userId);
      }
    }

    return online;
  }

  private publish(userId: string, online: boolean): void {
    const payload: RealtimePresenceUpdatedEvent = { userId, online };

    this.realtimeService.emitToRoom(PRESENCE_ROOM, REALTIME_PRESENCE_EVENT, payload);
    this.logger.log(`User ${userId} is now ${online ? 'online' : 'offline'}`);
  }

  /** Whether the user has at least one socket inside the freshness window. */
  private async hasLiveSocket(client: Redis, userId: string): Promise<boolean> {
    const online = await this.onlineAmong([userId]);

    return online.has(userId);
  }

  private expiredBefore(): number {
    return Date.now() - REALTIME_PRESENCE_TTL_MS;
  }

  private buildMember(userId: string, socketId: string): string {
    return `${userId}:${socketId}`;
  }

  private parseMemberUserId(member: string): string | null {
    const separator = member.lastIndexOf(':');

    return separator > 0 ? member.slice(0, separator) : null;
  }

  /**
   * Presence is a nice-to-have, so a missing Redis degrades to "nobody is
   * online" instead of failing the connection that triggered it.
   */
  private getClient(): Redis | null {
    return this.redisService.getOrNil();
  }
}
