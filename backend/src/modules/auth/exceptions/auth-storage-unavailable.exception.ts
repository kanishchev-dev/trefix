import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthStorageUnavailableException extends DomainException {
  constructor() {
    super('AUTH_STORAGE_UNAVAILABLE', 'Authentication storage is unavailable', HttpStatus.SERVICE_UNAVAILABLE);
  }
}
