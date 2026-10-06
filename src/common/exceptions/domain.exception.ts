import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Business-rule exception with a stable machine-readable `code`.
 * `details` carries structured context (e.g. the active plan on
 * `ACTIVE_PLAN_EXISTS`) and is passed through to the error response body.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ message, code, details }, status);
  }
}
