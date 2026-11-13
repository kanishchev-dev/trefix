import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthEmailAlreadyExistsException extends DomainException {
  constructor() {
    super('AUTH_EMAIL_ALREADY_EXISTS', 'A user with this email already exists', HttpStatus.CONFLICT);
  }
}
