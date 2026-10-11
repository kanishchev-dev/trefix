import { HttpStatus, ValidationError } from '@nestjs/common';

import { DomainException } from './domain.exception';

/** One rejected input field; `path` is dotted for nested DTOs (`schedule.days.0`). */
export interface ValidationErrorDetail {
  path: string;
  constraints: Record<string, string>;
}

/** Input rejected by `class-validator`; every failed field is listed in `details.errors`. */
export class ValidationException extends DomainException {
  constructor(public readonly errors: ValidationErrorDetail[]) {
    super('VALIDATION_ERROR', 'Validation failed', HttpStatus.BAD_REQUEST, { errors });
  }

  /** `exceptionFactory` for the global `ValidationPipe`. */
  static fromValidationErrors(errors: ValidationError[]): ValidationException {
    return new ValidationException(flattenValidationErrors(errors));
  }
}

function flattenValidationErrors(errors: ValidationError[], parentPath = ''): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own = error.constraints ? [{ path, constraints: error.constraints }] : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], path)];
  });
}
