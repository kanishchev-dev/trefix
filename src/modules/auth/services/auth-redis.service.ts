import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { RedisService } from '@/common/redis/redis.service';

import {
  AUTH_EMAIL_OTP_COOLDOWN_REDIS_PREFIX,
  AUTH_EMAIL_OTP_REDIS_PREFIX,
  AUTH_EMAIL_VERIFICATION_COOLDOWN_REDIS_PREFIX,
  AUTH_EMAIL_VERIFICATION_REDIS_PREFIX,
  AUTH_PASSWORD_RESET_REDIS_PREFIX,
  AUTH_SESSION_IDS_REDIS_PREFIX,
  AUTH_SESSION_REDIS_PREFIX,
  AUTH_SOCIAL_RESULT_REDIS_PREFIX,
  AUTH_SOCIAL_STATE_REDIS_PREFIX,
} from '../auth.constants';
import { AuthStorageUnavailableException } from '../exceptions/auth-storage-unavailable.exception';
import { AuthCodeRecord } from '../interfaces/auth-code-record.interface';
import { AuthEmailOtpCodeRecord } from '../interfaces/auth-email-otp-code-record.interface';
import { AuthSessionRecord } from '../interfaces/auth-session.interface';
import { AuthSocialResultRecord } from '../interfaces/auth-social-result.interface';
import { AuthSocialStateRecord } from '../interfaces/auth-social-state.interface';

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

  async setEmailOtpCode(
    email: string,
    record: AuthEmailOtpCodeRecord,
    ttlMilliseconds: number,
    cooldownMilliseconds: number,
  ): Promise<void> {
    const client = this.getClient();
    await client
      .multi()
      .set(this.buildEmailOtpKey(email), JSON.stringify(record), 'PX', ttlMilliseconds)
      .set(this.buildEmailOtpCooldownKey(email), '1', 'PX', cooldownMilliseconds)
      .exec();
  }

  async getEmailOtpCode(email: string): Promise<AuthEmailOtpCodeRecord | null> {
    const record = await this.getCodeRecord(this.buildEmailOtpKey(email));
    if (!record) {
      return null;
    }

    return {
      ...record,
      email: this.normalizeEmail(email),
    };
  }

  async incrementEmailOtpAttempts(email: string, maxAttempts: number): Promise<AuthEmailOtpCodeRecord | null> {
    const record = await this.incrementCodeAttempts(this.buildEmailOtpKey(email), maxAttempts);
    if (!record) {
      return null;
    }

    return {
      ...record,
      email: this.normalizeEmail(email),
    };
  }

  async clearEmailOtpCode(email: string): Promise<void> {
    await this.deleteKeys(this.buildEmailOtpKey(email), this.buildEmailOtpCooldownKey(email));
  }

  async isEmailOtpCooldownActive(email: string): Promise<boolean> {
    const client = this.getClient();
    return (await client.exists(this.buildEmailOtpCooldownKey(email))) === 1;
  }

  async setSocialState(state: string, record: AuthSocialStateRecord, ttlMilliseconds: number): Promise<void> {
    const client = this.getClient();
    await client.set(this.buildSocialStateKey(state), JSON.stringify(record), 'PX', ttlMilliseconds);
  }

  /** Reads and removes the state in one command: a replayed callback finds nothing. */
  async consumeSocialState(state: string): Promise<AuthSocialStateRecord | null> {
    return this.consumeJsonRecord<AuthSocialStateRecord>(this.buildSocialStateKey(state));
  }

  async setSocialResult(code: string, record: AuthSocialResultRecord, ttlMilliseconds: number): Promise<void> {
    const client = this.getClient();
    await client.set(this.buildSocialResultKey(code), JSON.stringify(record), 'PX', ttlMilliseconds);
  }

  /** Single-use handoff: two parallel exchanges of one code cannot both get the tokens. */
  async consumeSocialResult(code: string): Promise<AuthSocialResultRecord | null> {
    return this.consumeJsonRecord<AuthSocialResultRecord>(this.buildSocialResultKey(code));
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
    return this.getJsonRecord<AuthCodeRecord>(key);
  }

  /**
   * Counts a failed guess in one Redis round trip.
   *
   * A read-modify-write from Node would let parallel wrong guesses all read the
   * same counter and push the real number of attempts past `maxAttempts`.
   * The record keeps its original TTL; reaching the limit burns the code.
   */
  private async incrementCodeAttempts(key: string, maxAttempts: number): Promise<AuthCodeRecord | null> {
    const raw = (await this.getClient().eval(
      `
        local raw = redis.call('GET', KEYS[1])
        if not raw then
          return nil
        end

        local record = cjson.decode(raw)
        record.attempts = (tonumber(record.attempts) or 0) + 1
        if record.attempts >= tonumber(ARGV[1]) then
          redis.call('DEL', KEYS[1])
          return nil
        end

        local ttl = redis.call('PTTL', KEYS[1])
        local encoded = cjson.encode(record)
        if ttl > 0 then
          redis.call('SET', KEYS[1], encoded, 'PX', ttl)
        else
          redis.call('SET', KEYS[1], encoded)
        end
        return encoded
      `,
      1,
      key,
      maxAttempts,
    )) as string | null;

    return raw ? (JSON.parse(raw) as AuthCodeRecord) : null;
  }

  private async deleteKeys(...keys: string[]): Promise<void> {
    const client = this.getClient();
    await client.del(...keys);
  }

  private async getJsonRecord<T>(key: string): Promise<T | null> {
    const client = this.getClient();
    const rawRecord = await client.get(key);
    if (!rawRecord) {
      return null;
    }

    return JSON.parse(rawRecord) as T;
  }

  private async consumeJsonRecord<T>(key: string): Promise<T | null> {
    const rawRecord = await this.getClient().getdel(key);
    return rawRecord ? (JSON.parse(rawRecord) as T) : null;
  }

  private buildEmailOtpKey(email: string): string {
    return `${AUTH_EMAIL_OTP_REDIS_PREFIX}${email}`;
  }

  private buildEmailOtpCooldownKey(email: string): string {
    return `${AUTH_EMAIL_OTP_COOLDOWN_REDIS_PREFIX}${email}`;
  }

  private buildSocialStateKey(state: string): string {
    return `${AUTH_SOCIAL_STATE_REDIS_PREFIX}${state}`;
  }

  private buildSocialResultKey(code: string): string {
    return `${AUTH_SOCIAL_RESULT_REDIS_PREFIX}${code}`;
  }

  private getClient(): Redis {
    const client = this.redisService.getOrNil();
    if (!client) {
      throw new AuthStorageUnavailableException();
    }

    return client;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
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
