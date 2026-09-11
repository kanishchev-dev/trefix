import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthSessionNotFoundException extends DomainException {
  constructor() {
    super('AUTH_SESSION_NOT_FOUND', 'Session is no longer active', HttpStatus.UNAUTHORIZED);
  }
}
