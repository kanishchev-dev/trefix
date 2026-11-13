import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class MailerTemplateRenderException extends DomainException {
  constructor(templateName: string, message: string) {
    super(
      'MAILER_TEMPLATE_RENDER_FAILED',
      `Failed to render mail template ${templateName}: ${message}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
