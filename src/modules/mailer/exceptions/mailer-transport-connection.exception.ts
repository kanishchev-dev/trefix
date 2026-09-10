import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class MailerTransportConnectionException extends DomainException {
  constructor(message: string) {
    super('MAILER_TRANSPORT_CONNECTION_FAILED', message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
