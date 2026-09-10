import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class StorageFileNotFoundException extends DomainException {
  constructor(fileId: string) {
    super('storage.ERRORS.FILE_NOT_FOUND', `Storage file with ID ${fileId} not found`, HttpStatus.NOT_FOUND);
  }
}
