import { HttpStatus } from '@nestjs/common';

import { DomainException } from './domain.exception';

/**
 * Exception thrown when a requested entity is not found.
 * Uses i18n-friendly codes.
 */
export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id: string) {
    const code = `${entityName.toLowerCase()}.ERRORS.${entityName.toUpperCase()}_NOT_FOUND`;
    super(code, `${entityName} with ID ${id} not found`, HttpStatus.NOT_FOUND);
  }
}
