import { Injectable, PipeTransform } from '@nestjs/common';

import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';

import type { AuthSocialProvider } from '../interfaces/auth-social-provider.interface';

const PROVIDERS: readonly AuthSocialProvider[] = ['apple', 'google'];

@Injectable()
export class SocialProviderParamPipe implements PipeTransform<string, AuthSocialProvider> {
  transform(value: string): AuthSocialProvider {
    if (!(PROVIDERS as readonly string[]).includes(value)) {
      throw new DomainBadRequestException('AUTH_SOCIAL_PROVIDER_INVALID', 'Unknown sign-in provider');
    }
    return value as AuthSocialProvider;
  }
}
