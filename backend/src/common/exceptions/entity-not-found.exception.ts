import { HttpStatus } from '@nestjs/common';

import { DomainException } from './domain.exception';
import { toErrorCodePart } from './error-code.util';

/** A requested entity does not exist (or is not visible to the requester): `<ENTITY>_NOT_FOUND`. */
export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id: string) {
    super(
      `${toErrorCodePart(entityName)}_NOT_FOUND`,
      `${entityName} with ID ${id} not found`,
      HttpStatus.NOT_FOUND,
      undefined,
      {
        id,
      },
    );
  }
}
