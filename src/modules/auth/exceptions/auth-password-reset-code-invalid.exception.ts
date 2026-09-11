import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthPasswordResetCodeInvalidException extends DomainException {
  constructor() {
    super('AUTH_PASSWORD_RESET_CODE_INVALID', 'Password reset code is invalid or expired', HttpStatus.BAD_REQUEST);
  }
}
