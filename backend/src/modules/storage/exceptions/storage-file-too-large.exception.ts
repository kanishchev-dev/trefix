import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class StorageFileTooLargeException extends DomainException {
  constructor(maxFileSize: number) {
    super(
      'FILE_TOO_LARGE',
      `Uploaded file exceeds the configured limit of ${maxFileSize} bytes`,
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}
