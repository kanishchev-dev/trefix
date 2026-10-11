import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Redis } from 'ioredis';

import { RedisService } from '@/common/redis/redis.service';

import { OAUTH_STATE_REDIS_PREFIX, OAUTH_STATE_TTL_MS } from '../constants/integrations.constants';
import { IntegrationStorageUnavailableException } from '../exceptions/integration-storage-unavailable.exception';

export type OAuthStatePurpose = 'connect' | 'profile';

export interface OAuthStateRecord {
  athleteId: string;
  purpose: OAuthStatePurpose;
}

/**
 * Pending OAuth authorizations.
 *
 * Lives in Redis rather than process memory: the provider redirects the user
 * back to whichever instance the balancer picks, possibly after a deploy.
 */
@Injectable()
export class OAuthStateStore {
  constructor(private readonly redisService: RedisService) {}

  /** Creates a single-use `state` value bound to the athlete. */
  async issue(record: OAuthStateRecord): Promise<string> {
    const state = randomBytes(16).toString('hex');
    await this.getClient().set(this.buildKey(state), JSON.stringify(record), 'PX', OAUTH_STATE_TTL_MS);
    return state;
  }

  /**
   * Returns the record and removes it in one command, so a replayed callback
   * cannot reuse the same authorization.
   */
  async consume(state: string): Promise<OAuthStateRecord | null> {
    if (!state) {
      return null;
    }

    const raw = await this.getClient().getdel(this.buildKey(state));
    return raw ? (JSON.parse(raw) as OAuthStateRecord) : null;
  }

  private buildKey(state: string): string {
    return `${OAUTH_STATE_REDIS_PREFIX}${state}`;
  }

  private getClient(): Redis {
    const client = this.redisService.getOrNil();
    if (!client) {
      throw new IntegrationStorageUnavailableException();
    }
    return client;
  }
}
