import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthPasswordResetTokenExpiredException extends DomainException {
  constructor() {
    super('AUTH_PASSWORD_RESET_TOKEN_EXPIRED', 'Password reset token is invalid or expired', HttpStatus.BAD_REQUEST);
  }
}
