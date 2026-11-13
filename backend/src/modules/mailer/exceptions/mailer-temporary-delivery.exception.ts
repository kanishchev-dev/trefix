import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class MailerTemporaryDeliveryException extends DomainException {
  constructor(message: string) {
    super('MAILER_TEMPORARY_DELIVERY_FAILED', message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
