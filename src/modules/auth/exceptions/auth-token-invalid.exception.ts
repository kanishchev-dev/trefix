import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthTokenInvalidException extends DomainException {
  constructor() {
    super('AUTH_TOKEN_INVALID', 'Authentication token is invalid', HttpStatus.UNAUTHORIZED);
  }
}
