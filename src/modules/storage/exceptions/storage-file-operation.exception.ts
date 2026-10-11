import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class StorageFileOperationException extends DomainException {
  constructor(message: string, code = 'FILE_OPERATION_FAILED') {
    super(code, message, HttpStatus.BAD_GATEWAY);
  }
}
