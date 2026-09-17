import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthSocialFlowInvalidException extends DomainException {
  constructor(message = 'Social authentication failed') {
    super('AUTH_SOCIAL_FLOW_INVALID', message, HttpStatus.BAD_REQUEST);
  }
}
