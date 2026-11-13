import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class MailerConfigurationException extends DomainException {
  constructor(message: string) {
    super('MAILER_CONFIGURATION_INVALID', message, HttpStatus.BAD_REQUEST);
  }
}
