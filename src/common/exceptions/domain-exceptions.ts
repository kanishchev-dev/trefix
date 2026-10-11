import { HttpStatus } from '@nestjs/common';

import { DomainException } from './domain.exception';

/*
 * Semantic categories of business-rule failures.
 *
 * Services throw these by meaning ("the request conflicts with the current
 * state") and never pick an HTTP status themselves; the mapping to a status
 * lives here and the response shape in `DomainExceptionFilter`.
 */

/** The input is well-formed but violates a business rule. */
export class DomainBadRequestException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.BAD_REQUEST, details);
  }
}

/** The referenced resource does not exist or is not visible to the caller. */
export class DomainNotFoundException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.NOT_FOUND, details);
  }
}

/** The action is not allowed for this actor or this resource. */
export class ForbiddenActionException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.FORBIDDEN, details);
  }
}

/** The action conflicts with the current state of the resource. */
export class DomainConflictException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

/** The input is valid on its own but cannot be processed in this context. */
export class DomainUnprocessableException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

/** The submitted payload exceeds a business limit. */
export class DomainPayloadTooLargeException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.PAYLOAD_TOO_LARGE, details);
  }
}

/** A dependency the action needs is temporarily unavailable. */
export class DomainUnavailableException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.SERVICE_UNAVAILABLE, details);
  }
}
