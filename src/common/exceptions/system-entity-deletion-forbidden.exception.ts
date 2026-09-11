import { HttpStatus } from '@nestjs/common';

import { DomainException } from './domain.exception';

export class SystemEntityDeletionForbiddenException extends DomainException {
  constructor(entityName: string) {
    super(
      'common.ERRORS.SYSTEM_ENTITY_DELETION_FORBIDDEN',
      `System ${entityName} cannot be deleted`,
      HttpStatus.FORBIDDEN,
    );
  }
}
