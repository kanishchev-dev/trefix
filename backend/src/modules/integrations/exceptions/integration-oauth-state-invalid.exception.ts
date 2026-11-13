import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class IntegrationOAuthStateInvalidException extends DomainException {
  constructor() {
    super('INTEGRATION_OAUTH_STATE_INVALID', 'Invalid or expired OAuth state parameter', HttpStatus.BAD_REQUEST);
  }
}
