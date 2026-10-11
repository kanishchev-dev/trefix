import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';

import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { normalizeEmail, resolveRegistrationName } from '../auth.helpers';
import { AppleNativeExchangeDto } from '../dto/apple-native-exchange.dto';
import { GoogleNativeExchangeDto } from '../dto/google-native-exchange.dto';
import { SocialExchangeDto } from '../dto/social-exchange.dto';
import { AuthEmailVerifiedEvent } from '../events/auth-email-verified.event';
import { AuthSocialFlowInvalidException } from '../exceptions/auth-social-flow-invalid.exception';
import { AuthSocialProvider } from '../interfaces/auth-social-provider.interface';
import { AuthenticatedUserResult } from '../interfaces/authenticated-user-result.interface';
import { parseDurationToMilliseconds } from '../utils/duration.util';
import { AuthRedisService } from './auth-redis.service';
import { AuthSessionService } from './auth-session.service';
import { SocialIdentityService, type SocialProfile } from './social-identity.service';

/**
 * Social sign-in flows: web redirect with state, one-time result exchange and native app tokens.
 */
@Injectable()
export class AuthSocialFlowService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authRedisService: AuthRedisService,
    private readonly userPermissionsService: UserPermissionsService,
    private readonly socialIdentity: SocialIdentityService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async buildSocialStartUrl(provider: AuthSocialProvider, redirectUri: string): Promise<string> {
    const normalizedProvider = this.normalizeSocialProvider(provider);
    const normalizedRedirectUri = this.normalizeRedirectUri(redirectUri);
    const state = randomUUID();

    await this.authRedisService.setSocialState(
      state,
      {
        provider: normalizedProvider,
        redirectUri: normalizedRedirectUri,
        createdAt: new Date().toISOString(),
      },
      this.getSocialTtlMilliseconds(),
    );

    return this.socialIdentity.authorizationUrl(normalizedProvider, state);
  }

  async completeSocialCallback(provider: AuthSocialProvider, code: string, state: string): Promise<string> {
    const stateRecord = await this.authRedisService.consumeSocialState(state);
    if (!stateRecord || stateRecord.provider !== provider) {
      throw new AuthSocialFlowInvalidException();
    }

    try {
      const profile = await this.socialIdentity.resolveProfile(provider, code);
      const authenticatedResult = await this.finalizeSocialSignIn(profile);
      const handoffCode = randomUUID();

      await this.authRedisService.setSocialResult(
        handoffCode,
        {
          user: this.authSessionService.toAuthUserContext(
            authenticatedResult.user,
            authenticatedResult.tokens.sessionId,
          ),
          tokens: authenticatedResult.tokens,
        },
        this.getSocialTtlMilliseconds(),
      );

      return this.buildSocialRedirectUri(stateRecord.redirectUri, { code: handoffCode });
    } catch {
      return this.buildSocialRedirectUri(stateRecord.redirectUri, {
        error: 'social_auth_failed',
      });
    }
  }

  async exchangeSocialCode(dto: SocialExchangeDto): Promise<AuthenticatedUserResult> {
    const record = await this.authRedisService.consumeSocialResult(dto.code);
    if (!record) {
      throw new AuthSocialFlowInvalidException();
    }

    const user = await this.usersService.findOne(record.user.id);

    return {
      user,
      permissions: await this.userPermissionsService.getEffectivePermissions(user.id),
      tokens: record.tokens,
    };
  }

  async exchangeNativeAppleCode(dto: AppleNativeExchangeDto): Promise<AuthenticatedUserResult> {
    const profile = await this.socialIdentity.resolveAppleNativeProfile(dto.authorizationCode);
    return this.finalizeSocialSignIn(profile);
  }

  async exchangeNativeGoogleCode(dto: GoogleNativeExchangeDto): Promise<AuthenticatedUserResult> {
    const profile = await this.socialIdentity.resolveGoogleNativeProfile(dto.idToken);
    return this.finalizeSocialSignIn(profile);
  }

  private async resolveOrCreateSocialUser(email: string): Promise<User> {
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      return existingUser;
    }

    const { firstName, lastName } = resolveRegistrationName(normalizedEmail);
    return this.usersService.create({
      email: normalizedEmail,
      firstName,
      lastName,
      emailVerified: true,
    });
  }

  private async finalizeSocialSignIn(profile: SocialProfile): Promise<AuthenticatedUserResult> {
    const user = await this.resolveOrCreateSocialUser(profile.email);

    let currentUser = user;
    if (!currentUser.emailVerified) {
      currentUser = await this.usersService.setEmailVerified(currentUser.id, true);
      this.eventEmitter.emit(AUTH_EVENTS.EMAIL_VERIFIED, new AuthEmailVerifiedEvent(currentUser.id, currentUser.email));
    }

    return this.authSessionService.createAuthenticatedSession(currentUser, {
      userAgent: undefined,
      ipAddress: undefined,
    });
  }

  private buildSocialRedirectUri(redirectUri: string, params: { code?: string; error?: string }): string {
    const url = new URL(redirectUri);
    if (params.code) {
      url.searchParams.set('code', params.code);
    }
    if (params.error) {
      url.searchParams.set('error', params.error);
    }

    return url.toString();
  }

  private normalizeSocialProvider(provider: AuthSocialProvider): AuthSocialProvider {
    if (provider === 'google' || provider === 'apple') {
      return provider;
    }

    throw new AuthSocialFlowInvalidException();
  }

  private normalizeRedirectUri(redirectUri: string): string {
    const normalizedRedirectUri = redirectUri.trim();
    if (!normalizedRedirectUri.startsWith('workspace-auth://')) {
      throw new AuthSocialFlowInvalidException();
    }

    return normalizedRedirectUri;
  }

  /** Social state and results live as long as an email code. */
  private getSocialTtlMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.emailCodeExpiresIn'));
  }
}
