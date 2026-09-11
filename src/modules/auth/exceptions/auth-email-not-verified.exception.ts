import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthEmailNotVerifiedException extends DomainException {
  constructor() {
    super('AUTH_EMAIL_NOT_VERIFIED', 'Email address is not verified', HttpStatus.FORBIDDEN);
  }
}
