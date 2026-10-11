import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class StorageInvalidUploadPayloadException extends DomainException {
  constructor() {
    super('INVALID_UPLOAD_PAYLOAD', 'Invalid file upload payload', HttpStatus.BAD_REQUEST);
  }
}
