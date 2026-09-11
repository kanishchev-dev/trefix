import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthInvalidCredentialsException extends DomainException {
  constructor() {
    super('AUTH_INVALID_CREDENTIALS', 'Invalid email or password', HttpStatus.UNAUTHORIZED);
  }
}
