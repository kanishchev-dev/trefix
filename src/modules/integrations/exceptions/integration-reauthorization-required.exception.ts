import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class IntegrationReauthorizationRequiredException extends DomainException {
  constructor() {
    super('INTEGRATION_REAUTHORIZATION_REQUIRED', 'Reconnect the integration to continue', HttpStatus.CONFLICT);
  }
}
