import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthSocialProviderUnavailableException extends DomainException {
  constructor() {
    super('AUTH_SOCIAL_PROVIDER_UNAVAILABLE', 'Social sign-in is not configured', HttpStatus.SERVICE_UNAVAILABLE);
  }
}
