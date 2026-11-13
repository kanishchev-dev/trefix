import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class MailerInvalidRecipientException extends DomainException {
  constructor(recipient: string) {
    super('MAILER_INVALID_RECIPIENT', `Invalid email recipient: ${recipient}`, HttpStatus.BAD_REQUEST);
  }
}
