import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AUTH_ACCESS_TOKEN_TYPE, AUTH_REFRESH_TOKEN_TYPE, AUTH_TOKEN_ISSUER } from '../auth.constants';
import { AuthJwtPayload } from '../interfaces/auth-jwt-payload.interface';
import { AuthRefreshTokenPayload } from '../interfaces/auth-refresh-token-payload.interface';
import { parseDurationToSeconds } from '../utils/duration.util';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signAccessToken(userId: string, sessionId: string): Promise<string> {
    return this.jwtService.signAsync(this.buildPayload(userId, sessionId, AUTH_ACCESS_TOKEN_TYPE), {
      secret: this.getAccessTokenSecret(),
      expiresIn: this.configService.getOrThrow<string>('auth.accessTokenExpiresIn'),
      issuer: AUTH_TOKEN_ISSUER,
    });
  }

  async signRefreshToken(userId: string, sessionId: string): Promise<string> {
    return this.jwtService.signAsync(this.buildPayload(userId, sessionId, AUTH_REFRESH_TOKEN_TYPE), {
      secret: this.getRefreshTokenSecret(),
      expiresIn: this.configService.getOrThrow<string>('auth.refreshTokenExpiresIn'),
      issuer: AUTH_TOKEN_ISSUER,
    });
  }

  async verifyRefreshToken(token: string): Promise<AuthRefreshTokenPayload> {
    return this.jwtService.verifyAsync<AuthRefreshTokenPayload>(token, {
      secret: this.getRefreshTokenSecret(),
      issuer: AUTH_TOKEN_ISSUER,
    });
  }

  getAccessTokenTtlSeconds(): number {
    return parseDurationToSeconds(this.configService.getOrThrow<string>('auth.accessTokenExpiresIn'));
  }

  private buildPayload(userId: string, sessionId: string, tokenType: AuthJwtPayload['tokenType']): AuthJwtPayload {
    return {
      sub: userId,
      sessionId,
      tokenType,
    };
  }

  private getAccessTokenSecret(): string {
    return this.configService.getOrThrow<string>('auth.accessTokenSecret');
  }

  private getRefreshTokenSecret(): string {
    return this.configService.getOrThrow<string>('auth.refreshTokenSecret');
  }
}
