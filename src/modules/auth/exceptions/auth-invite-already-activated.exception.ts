import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthInviteAlreadyActivatedException extends DomainException {
  constructor() {
    super(
      'AUTH_INVITE_ALREADY_ACTIVATED',
      'This account has already been activated',
      HttpStatus.CONFLICT,
    );
  }
}