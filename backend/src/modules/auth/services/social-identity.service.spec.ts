import { ConfigService } from '@nestjs/config';

import { AuthSocialProviderUnavailableException } from '../exceptions/auth-social-provider-unavailable.exception';
import { SocialIdentityService } from './social-identity.service';

describe('SocialIdentityService', () => {
  const config: Record<string, string> = {
    'app.apiBaseUrl': 'https://api.trefix.example',
    'auth.googleOAuthClientId': 'google-client',
    'auth.appleOAuthClientId': 'apple-client',
  };
  const configService = {
    get: (key: string): string | undefined => config[key],
    getOrThrow: (key: string): string => config[key],
  } as unknown as ConfigService;
  const service = new SocialIdentityService(configService);

  it('builds the callback from the configured API URL, never from request headers', () => {
    const url = new URL(service.authorizationUrl('google', 'state-1'));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.trefix.example/v1/auth/social/google/callback');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('client_id')).toBe('google-client');
  });

  it('asks Apple to post the result back to the Apple callback', () => {
    const url = new URL(service.authorizationUrl('apple', 'state-2'));

    expect(url.searchParams.get('redirect_uri')).toBe('https://api.trefix.example/v1/auth/social/apple/callback');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
  });

  it('reports a provider without credentials as unavailable', () => {
    const unconfigured = new SocialIdentityService({
      get: (): undefined => undefined,
      getOrThrow: (): string => 'https://api.trefix.example',
    } as unknown as ConfigService);

    expect(() => unconfigured.authorizationUrl('google', 'state-3')).toThrow(AuthSocialProviderUnavailableException);
  });
});
