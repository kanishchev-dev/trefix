import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthVerificationCodeInvalidException extends DomainException {
  constructor() {
    super('AUTH_VERIFICATION_CODE_INVALID', 'Verification code is invalid or expired', HttpStatus.BAD_REQUEST);
  }
}
