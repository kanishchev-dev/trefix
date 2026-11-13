import { HttpStatus } from '@nestjs/common';

import { DomainException } from './domain.exception';
import { toErrorCodePart } from './error-code.util';

/** A unique field is taken: `<ENTITY>_<FIELD>_ALREADY_EXISTS`. */
export class EntityAlreadyExistsException extends DomainException {
  constructor(entityName: string, fieldName: string, fieldValue: string) {
    super(
      `${toErrorCodePart(entityName)}_${toErrorCodePart(fieldName)}_ALREADY_EXISTS`,
      `${entityName} with ${fieldName} ${fieldValue} already exists`,
      HttpStatus.CONFLICT,
      undefined,
      { field: fieldName, value: fieldValue },
    );
  }
}
