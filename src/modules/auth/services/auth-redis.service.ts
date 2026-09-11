import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import {
  AUTH_EMAIL_VERIFICATION_COOLDOWN_REDIS_PREFIX,
  AUTH_EMAIL_VERIFICATION_REDIS_PREFIX,
  AUTH_PASSWORD_RESET_REDIS_PREFIX,
  AUTH_SESSION_IDS_REDIS_PREFIX,
  AUTH_SESSION_REDIS_PREFIX,
} from '../auth.constants';
import { AuthStorageUnavailableException } from '../exceptions/auth-storage-unavailable.exception';
import { AuthCodeRecord } from '../interfaces/auth-code-record.interface';
import { AuthSessionRecord } from '../interfaces/auth-session.interface';

type RedisRotationResult = ['missing'] | ['reused', string] | ['rotated', string];

@Injectable()
export class AuthRedisService {
  constructor(private readonly redisService: RedisService) {}

  async createSession(session: AuthSessionRecord, ttlMilliseconds: number): Promise<void> {
    const client = this.getClient();
    const sessionKey = this.buildSessionKey(session.sessionId);
    const userSessionsKey = this.buildUserSessionsKey(session.userId);

    await client
      .multi()
      .set(sessionKey, JSON.stringify(session), 'PX', ttlMilliseconds)
      .sadd(userSessionsKey, session.sessionId)
      .pexpire(userSessionsKey, ttlMilliseconds)
      .exec();
  }

  async getSession(sessionId: string): Promise<AuthSessionRecord | null> {
    const client = this.getClient();
    const rawSession = await client.get(this.buildSessionKey(sessionId));
    if (!rawSession) {
      return null;
    }

    return JSON.parse(rawSession) as AuthSessionRecord;
  }

  async revokeSession(sessionId: string): Promise<AuthSessionRecord | null> {
    const client = this.getClient();
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    await client
      .multi()
      .del(this.buildSessionKey(sessionId))
      .srem(this.buildUserSessionsKey(session.userId), sessionId)
      .exec();

    return session;
  }

  async revokeUserSessions(userId: string): Promise<AuthSessionRecord[]> {
    const client = this.getClient();
    const userSessionsKey = this.buildUserSessionsKey(userId);
    const sessionIds = await client.smembers(userSessionsKey);

    if (sessionIds.length === 0) {
      return [];
    }

    const sessions = await this.getSessions(sessionIds);
    const pipeline = client.multi();

    sessionIds.forEach((sessionId) => {
      pipeline.del(this.buildSessionKey(sessionId));
    });

    pipeline.del(userSessionsKey);
    await pipeline.exec();

    return sessions.filter((session): session is AuthSessionRecord => session !== null);
  }

  async rotateSession(
    sessionId: string,
    userId: string,
    expectedRefreshTokenHash: string,
    nextRefreshTokenHash: string,
    ttlMilliseconds: number,
  ): Promise<{ status: 'missing' | 'reused' | 'rotated'; session: AuthSessionRecord | null }> {
    const client = this.getClient();
    const result = (await client.eval(
      `
        local sessionKey = KEYS[1]
        local userSessionsKey = KEYS[2]
        local expectedHash = ARGV[1]
        local nextHash = ARGV[2]
        local ttl = tonumber(ARGV[3])
        local updatedAt = ARGV[4]
        local nextExpiresAt = ARGV[5]

        local rawSession = redis.call('GET', sessionKey)
        if not rawSession then
          return {'missing'}
        end

        local session = cjson.decode(rawSession)
        if session.refreshTokenHash ~= expectedHash then
          redis.call('DEL', sessionKey)
          redis.call('SREM', userSessionsKey, session.sessionId)
          return {'reused', cjson.encode(session)}
        end

        session.refreshTokenHash = nextHash
        session.updatedAt = updatedAt
        session.expiresAt = nextExpiresAt
        redis.call('SET', sessionKey, cjson.encode(session), 'PX', ttl)
        redis.call('PEXPIRE', userSessionsKey, ttl)
        return {'rotated', cjson.encode(session)}
      `,
      2,
      this.buildSessionKey(sessionId),
      this.buildUserSessionsKey(userId),
      expectedRefreshTokenHash,
      nextRefreshTokenHash,
      ttlMilliseconds,
      new Date().toISOString(),
      new Date(Date.now() + ttlMilliseconds).toISOString(),
    )) as RedisRotationResult | null;

    if (!result) {
      return { status: 'missing', session: null };
    }

    const [status, rawSession] = result;
    if (status === 'missing') {
      return { status, session: null };
    }

    const session = JSON.parse(rawSession) as AuthSessionRecord;
    return { status, session };
  }

  async setVerificationCode(
    userId: string,
    record: AuthCodeRecord,
    ttlMilliseconds: number,
    cooldownMilliseconds: number,
  ): Promise<void> {
    const client = this.getClient();
    await client
      .multi()
      .set(this.buildEmailVerificationKey(userId), JSON.stringify(record), 'PX', ttlMilliseconds)
      .set(this.buildVerificationCooldownKey(userId), '1', 'PX', cooldownMilliseconds)
      .exec();
  }

  async getVerificationCode(userId: string): Promise<AuthCodeRecord | null> {
    return this.getCodeRecord(this.buildEmailVerificationKey(userId));
  }

  async incrementVerificationAttempts(userId: string, maxAttempts: number): Promise<AuthCodeRecord | null> {
    return this.incrementCodeAttempts(this.buildEmailVerificationKey(userId), maxAttempts);
  }

  async clearVerificationCode(userId: string): Promise<void> {
    await this.deleteKeys(this.buildEmailVerificationKey(userId), this.buildVerificationCooldownKey(userId));
  }

  async isVerificationCooldownActive(userId: string): Promise<boolean> {
    const client = this.getClient();
    return (await client.exists(this.buildVerificationCooldownKey(userId))) === 1;
  }

  async setPasswordResetCode(userId: string, record: AuthCodeRecord, ttlMilliseconds: number): Promise<void> {
    const client = this.getClient();
    await client.set(this.buildPasswordResetKey(userId), JSON.stringify(record), 'PX', ttlMilliseconds);
  }

  async getPasswordResetCode(userId: string): Promise<AuthCodeRecord | null> {
    return this.getCodeRecord(this.buildPasswordResetKey(userId));
  }

  async incrementPasswordResetAttempts(userId: string, maxAttempts: number): Promise<AuthCodeRecord | null> {
    return this.incrementCodeAttempts(this.buildPasswordResetKey(userId), maxAttempts);
  }

  async clearPasswordResetCode(userId: string): Promise<void> {
    await this.deleteKeys(this.buildPasswordResetKey(userId));
  }

  private async getSessions(sessionIds: string[]): Promise<Array<AuthSessionRecord | null>> {
    const client = this.getClient();
    const pipeline = client.multi();
    sessionIds.forEach((sessionId) => pipeline.get(this.buildSessionKey(sessionId)));
    const results = await pipeline.exec();

    return (results ?? []).map((entry) => {
      const rawSession = Array.isArray(entry) ? entry[1] : null;
      if (typeof rawSession !== 'string') {
        return null;
      }

      return JSON.parse(rawSession) as AuthSessionRecord;
    });
  }

  private async getCodeRecord(key: string): Promise<AuthCodeRecord | null> {
    const client = this.getClient();
    const rawRecord = await client.get(key);
    if (!rawRecord) {
      return null;
    }

    return JSON.parse(rawRecord) as AuthCodeRecord;
  }

  private async incrementCodeAttempts(key: string, maxAttempts: number): Promise<AuthCodeRecord | null> {
    const client = this.getClient();
    const record = await this.getCodeRecord(key);
    if (!record) {
      return null;
    }

    const nextRecord: AuthCodeRecord = {
      ...record,
      attempts: record.attempts + 1,
    };

    if (nextRecord.attempts >= maxAttempts) {
      await client.del(key);
      return null;
    }

    await client.set(
      key,
      JSON.stringify(nextRecord),
      'PX',
      Math.max(1, this.expiresAtToRemainingTtl(nextRecord.expiresAt)),
    );
    return nextRecord;
  }

  private async deleteKeys(...keys: string[]): Promise<void> {
    const client = this.getClient();
    await client.del(...keys);
  }

  private expiresAtToRemainingTtl(expiresAt: string): number {
    const expiresAtMs = new Date(expiresAt).getTime();
    return Math.max(1, expiresAtMs - Date.now());
  }

  private getClient(): Redis {
    const client = this.redisService.getOrNil();
    if (!client) {
      throw new AuthStorageUnavailableException();
    }

    return client;
  }

  private buildSessionKey(sessionId: string): string {
    return `${AUTH_SESSION_REDIS_PREFIX}${sessionId}`;
  }

  private buildUserSessionsKey(userId: string): string {
    return `${AUTH_SESSION_IDS_REDIS_PREFIX}${userId}`;
  }

  private buildEmailVerificationKey(userId: string): string {
    return `${AUTH_EMAIL_VERIFICATION_REDIS_PREFIX}${userId}`;
  }

  private buildVerificationCooldownKey(userId: string): string {
    return `${AUTH_EMAIL_VERIFICATION_COOLDOWN_REDIS_PREFIX}${userId}`;
  }

  private buildPasswordResetKey(userId: string): string {
    return `${AUTH_PASSWORD_RESET_REDIS_PREFIX}${userId}`;
  }
}
