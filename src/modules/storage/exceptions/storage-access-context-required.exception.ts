import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class StorageAccessContextRequiredException extends DomainException {
  constructor() {
    super(
      'storage.ERRORS.REQUESTER_USER_ID_REQUIRED',
      'Requester user ID is required for storage access',
      HttpStatus.BAD_REQUEST,
    );
  }
}
