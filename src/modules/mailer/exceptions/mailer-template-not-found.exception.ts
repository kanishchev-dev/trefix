import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class MailerTemplateNotFoundException extends DomainException {
  constructor(templateName: string) {
    super('MAILER_TEMPLATE_NOT_FOUND', `Mail template not found: ${templateName}`, HttpStatus.NOT_FOUND);
  }
}
