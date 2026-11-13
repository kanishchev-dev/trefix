import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

import { AuthSocialFlowInvalidException } from '../exceptions/auth-social-flow-invalid.exception';
import { AuthSocialProviderUnavailableException } from '../exceptions/auth-social-provider-unavailable.exception';
import { AuthSocialProvider } from '../interfaces/auth-social-provider.interface';

/** Identity confirmed by a social provider. */
export interface SocialProfile {
  email: string;
  firstName: string;
  lastName: string;
  providerSubject: string;
}

interface SocialTokenResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
}

interface GoogleUserInfoResponse {
  email?: string;
  email_verified?: boolean;
  family_name?: string;
  given_name?: string;
  name?: string;
  sub?: string;
}

interface GoogleIdTokenPayload {
  email?: string;
  email_verified?: boolean | string;
  family_name?: string;
  given_name?: string;
  name?: string;
  sub?: string;
}

interface AppleIdTokenPayload {
  email?: string;
  email_verified?: boolean | string;
  family_name?: string;
  given_name?: string;
  is_private_email?: boolean | string;
  name?: string;
  sub?: string;
}

interface GoogleCertsResponse {
  [key: string]: string;
}

/**
 * OAuth / OpenID Connect with Google and Apple: authorization URLs, code
 * exchange and token verification. Knows nothing about sessions — it only
 * turns a provider response into a verified `SocialProfile`.
 */
@Injectable()
export class SocialIdentityService {
  constructor(private readonly configService: ConfigService) {}

  /** Provider consent screen URL; the provider redirects back to our callback with `state`. */
  authorizationUrl(provider: AuthSocialProvider, state: string): string {
    const callbackUri = this.buildSocialCallbackUri(this.getApiBaseUrl(), provider);
    return provider === 'google'
      ? this.buildGoogleSocialStartUrl(state, callbackUri)
      : this.buildAppleSocialStartUrl(state, callbackUri);
  }

  /** Profile behind an authorization code delivered to the web callback. */
  async resolveProfile(provider: AuthSocialProvider, code: string): Promise<SocialProfile> {
    return this.resolveSocialProfile(provider, code, this.getApiBaseUrl());
  }

  /** Profile behind an authorization code from Sign in with Apple on the device (no redirect URI). */
  async resolveAppleNativeProfile(authorizationCode: string): Promise<SocialProfile> {
    return this.resolveAppleSocialProfile(authorizationCode);
  }

  private async resolveSocialProfile(
    provider: AuthSocialProvider,
    code: string,
    callbackBaseUrl: string,
  ): Promise<SocialProfile> {
    if (provider === 'google') {
      return this.resolveGoogleSocialProfile(code, callbackBaseUrl);
    }

    return this.resolveAppleSocialProfile(code, callbackBaseUrl);
  }

  private async resolveGoogleSocialProfile(code: string, callbackBaseUrl: string): Promise<SocialProfile> {
    const callbackUri = this.buildSocialCallbackUri(callbackBaseUrl, 'google');
    const clientId = this.getSocialConfigValue('auth.googleOAuthClientId');
    const clientSecret = this.getSocialConfigValue('auth.googleOAuthClientSecret');
    const tokenResponse = await this.exchangeGoogleSocialCode(code, callbackUri, clientId, clientSecret);
    const userInfo = await this.fetchGoogleUserInfo(tokenResponse.access_token);
    const idTokenPayload = tokenResponse.id_token
      ? this.decodeJwtPayload<GoogleIdTokenPayload>(tokenResponse.id_token)
      : null;

    const email = userInfo?.email ?? idTokenPayload?.email;
    if (!email) {
      throw new AuthSocialFlowInvalidException();
    }

    const normalizedEmail = this.normalizeEmail(email);
    const firstName = userInfo?.given_name ?? idTokenPayload?.given_name ?? '';
    const lastName = userInfo?.family_name ?? idTokenPayload?.family_name ?? '';

    return {
      email: normalizedEmail,
      firstName,
      lastName,
      providerSubject: userInfo?.sub ?? idTokenPayload?.sub ?? normalizedEmail,
    };
  }

  async resolveGoogleNativeProfile(idToken: string): Promise<SocialProfile> {
    const idTokenPayload = await this.verifyGoogleIdToken(idToken);
    const email = idTokenPayload.email;
    if (!email) {
      throw new AuthSocialFlowInvalidException();
    }

    const normalizedEmail = this.normalizeEmail(email);
    const firstName = idTokenPayload.given_name ?? '';
    const lastName = idTokenPayload.family_name ?? '';

    return {
      email: normalizedEmail,
      firstName,
      lastName,
      providerSubject: idTokenPayload.sub ?? normalizedEmail,
    };
  }

  private async resolveAppleSocialProfile(code: string, callbackBaseUrl?: string): Promise<SocialProfile> {
    const clientId = this.getSocialConfigValue('auth.appleOAuthClientId');
    const clientSecret = this.buildAppleClientSecret();
    const redirectUri = callbackBaseUrl ? this.buildSocialCallbackUri(callbackBaseUrl, 'apple') : undefined;
    const tokenResponse = await this.exchangeAppleSocialCode(code, redirectUri, clientId, clientSecret);
    const idTokenPayload = tokenResponse.id_token
      ? this.decodeJwtPayload<AppleIdTokenPayload>(tokenResponse.id_token)
      : null;

    const email = idTokenPayload?.email;
    if (!email) {
      throw new AuthSocialFlowInvalidException();
    }

    const normalizedEmail = this.normalizeEmail(email);
    const firstName = idTokenPayload?.given_name ?? '';
    const lastName = idTokenPayload?.family_name ?? '';

    return {
      email: normalizedEmail,
      firstName,
      lastName,
      providerSubject: idTokenPayload?.sub ?? normalizedEmail,
    };
  }

  private async exchangeGoogleSocialCode(
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string,
  ): Promise<SocialTokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    return this.parseOAuthTokenResponse<SocialTokenResponse>(response, 'Google');
  }

  private async exchangeAppleSocialCode(
    code: string,
    redirectUri: string | undefined,
    clientId: string,
    clientSecret: string,
  ): Promise<SocialTokenResponse> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    });

    if (redirectUri) {
      body.set('redirect_uri', redirectUri);
    }

    const response = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    return this.parseOAuthTokenResponse<SocialTokenResponse>(response, 'Apple');
  }

  private async fetchGoogleUserInfo(accessToken?: string): Promise<GoogleUserInfoResponse | null> {
    if (!accessToken) {
      return null;
    }

    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as GoogleUserInfoResponse;
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
    const decodedToken = jwt.decode(idToken, { complete: true });
    if (
      !decodedToken ||
      typeof decodedToken !== 'object' ||
      !('header' in decodedToken) ||
      !decodedToken.header ||
      typeof decodedToken.header !== 'object' ||
      typeof decodedToken.header.kid !== 'string'
    ) {
      throw new AuthSocialFlowInvalidException();
    }

    const certsResponse = await fetch('https://www.googleapis.com/oauth2/v1/certs');
    if (!certsResponse.ok) {
      throw new AuthSocialFlowInvalidException('Google certificate lookup failed');
    }

    const certs = (await certsResponse.json()) as GoogleCertsResponse;
    const publicKey = certs[decodedToken.header.kid];
    if (!publicKey) {
      throw new AuthSocialFlowInvalidException();
    }

    const audience = this.getSocialConfigValue('auth.googleOAuthClientId');
    const verified = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience,
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
    });

    if (!verified || typeof verified !== 'object') {
      throw new AuthSocialFlowInvalidException();
    }

    return verified as GoogleIdTokenPayload;
  }

  private buildGoogleSocialStartUrl(state: string, callbackUri: string): string {
    const clientId = this.getSocialConfigValue('auth.googleOAuthClientId');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');

    return url.toString();
  }

  private buildAppleSocialStartUrl(state: string, callbackUri: string): string {
    const clientId = this.getSocialConfigValue('auth.appleOAuthClientId');
    const url = new URL('https://appleid.apple.com/auth/authorize');

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'form_post');
    url.searchParams.set('scope', 'name email');
    url.searchParams.set('state', state);

    return url.toString();
  }

  /**
   * The provider redirect URI must match the one registered with Google/Apple,
   * so it comes from configuration — never from the request's Host header,
   * which the client controls and which a reverse proxy rewrites.
   */
  private getApiBaseUrl(): string {
    return this.configService.getOrThrow<string>('app.apiBaseUrl');
  }

  private buildSocialCallbackUri(callbackBaseUrl: string, provider: AuthSocialProvider): string {
    return new URL(`/v1/auth/social/${provider}/callback`, callbackBaseUrl).toString();
  }

  private buildAppleClientSecret(): string {
    const clientId = this.getSocialConfigValue('auth.appleOAuthClientId');
    const teamId = this.getSocialConfigValue('auth.appleOAuthTeamId');
    const keyId = this.getSocialConfigValue('auth.appleOAuthKeyId');
    const privateKey = this.getSocialConfigValue('auth.appleOAuthPrivateKey');
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        iss: teamId,
        iat: now,
        exp: now + 300,
        aud: 'https://appleid.apple.com',
        sub: clientId,
      },
      privateKey,
      {
        algorithm: 'ES256',
        keyid: keyId,
        header: {
          alg: 'ES256',
          kid: keyId,
        },
      },
    );
  }

  private async parseOAuthTokenResponse<T>(response: Response, provider: 'Google' | 'Apple'): Promise<T> {
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AuthSocialFlowInvalidException(`${provider} OAuth failed${body ? `: ${body}` : ''}`);
    }

    return (await response.json()) as T;
  }

  private decodeJwtPayload<T>(token: string): T {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object') {
      throw new AuthSocialFlowInvalidException();
    }

    return decoded as T;
  }

  private getSocialConfigValue(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new AuthSocialProviderUnavailableException();
    }

    return value;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
