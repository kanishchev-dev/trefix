import { HttpStatus } from '@nestjs/common';

import { DomainException } from './domain.exception';

export class EntityAlreadyExistsException extends DomainException {
  constructor(entityName: string, fieldName: string, fieldValue: string) {
    const normalizedEntityName = entityName.toLowerCase();
    const normalizedFieldName = fieldName.toUpperCase();
    const code = `${normalizedEntityName}.ERRORS.${normalizedEntityName.toUpperCase()}_${normalizedFieldName}_ALREADY_EXISTS`;

    super(code, `${entityName} with ${fieldName} ${fieldValue} already exists`, HttpStatus.CONFLICT);
  }
}
