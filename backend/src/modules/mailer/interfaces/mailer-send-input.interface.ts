import { MailAttachment } from './mailer-attachment.interface';

export interface MailerSendInput {
  readonly to: string | string[];
  readonly subject: string;
  readonly template?: string;
  readonly data?: Record<string, unknown>;
  readonly html?: string;
  readonly text?: string;
  readonly from?: string;
  readonly replyTo?: string;
  readonly attachments?: MailAttachment[];
}
