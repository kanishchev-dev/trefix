import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class MailerRateLimitException extends DomainException {
  constructor(message: string) {
    super('MAILER_RATE_LIMITED', message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
