import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class IntegrationStorageUnavailableException extends DomainException {
  constructor() {
    super('INTEGRATION_STORAGE_UNAVAILABLE', 'Integration storage is unavailable', HttpStatus.SERVICE_UNAVAILABLE);
  }
}
