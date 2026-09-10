import { HttpStatus } from '@nestjs/common';

import { DomainException } from './domain.exception';

export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id: string) {
    super(`${entityName.toUpperCase()}_NOT_FOUND`, `${entityName} with ID ${id} not found`, HttpStatus.NOT_FOUND);
  }
}
