import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthInviteCodeInvalidException extends DomainException {
  constructor() {
    super('AUTH_INVITE_CODE_INVALID', 'Invite code is invalid or expired', HttpStatus.BAD_REQUEST);
  }
}
