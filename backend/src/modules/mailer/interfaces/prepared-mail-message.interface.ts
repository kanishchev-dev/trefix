import { MailAttachment } from './mailer-attachment.interface';

export interface PreparedMailMessage {
  readonly to: string[];
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
  readonly from: string;
  readonly replyTo?: string;
  readonly template?: string;
  readonly attachments: MailAttachment[];
  readonly data?: Record<string, unknown>;
}
