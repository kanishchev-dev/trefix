import { HttpStatus } from '@nestjs/common';

import { DomainException } from './domain.exception';

/**
 * A state the code assumes impossible was reached — a bug, not a user error.
 * Mapped to 500; `message` is for logs and never shown to clients.
 */
export class InvariantViolationException extends DomainException {
  constructor(message: string) {
    super('INTERNAL_ERROR', message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
