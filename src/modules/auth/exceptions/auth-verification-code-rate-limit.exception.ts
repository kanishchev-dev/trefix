import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthVerificationCodeRateLimitException extends DomainException {
  constructor() {
    super(
      'AUTH_VERIFICATION_CODE_RATE_LIMITED',
      'Verification code was requested too recently',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
