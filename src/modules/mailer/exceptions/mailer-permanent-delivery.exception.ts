import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class MailerPermanentDeliveryException extends DomainException {
  constructor(message: string) {
    super('MAILER_PERMANENT_DELIVERY_FAILED', message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
