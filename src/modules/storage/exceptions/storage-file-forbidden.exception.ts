import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class StorageFileForbiddenException extends DomainException {
  constructor(fileId: string) {
    super(
      'storage.ERRORS.FILE_ACCESS_DENIED',
      `You do not have access to storage file ${fileId}`,
      HttpStatus.FORBIDDEN,
    );
  }
}
