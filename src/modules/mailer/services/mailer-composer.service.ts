import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';

import { MailerConfigurationException } from '../exceptions/mailer-configuration.exception';
import { MailerInvalidRecipientException } from '../exceptions/mailer-invalid-recipient.exception';
import { MailerSendInput } from '../interfaces/mailer-send-input.interface';
import { PreparedMailMessage } from '../interfaces/prepared-mail-message.interface';
import { isValidMailboxAddress, normalizeRecipients, parseMailbox } from '../utils/mailer-address.util';
import { MailerTemplateService } from './mailer-template.service';

@Injectable()
export class MailerComposerService {
  constructor(private readonly templateService: MailerTemplateService) {}

  async compose(input: MailerSendInput, defaultFrom: string, allowFromOverride: boolean): Promise<PreparedMailMessage> {
    const to = normalizeRecipients(input.to);
    if (to.length === 0) {
      throw new MailerInvalidRecipientException('');
    }

    for (const recipient of to) {
      if (!isValidMailboxAddress(parseMailbox(recipient).address)) {
        throw new MailerInvalidRecipientException(recipient);
      }
    }

    const from = this.resolveFrom(input.from, defaultFrom, allowFromOverride);
    const subject = input.subject.trim();
    if (!subject) {
      throw new MailerConfigurationException('Mail subject cannot be empty');
    }

    let html = input.html;
    let text = input.text;

    if (input.template) {
      const rendered = await this.templateService.render(input.template, input.data ?? {});
      html = rendered.html;
      text = text ?? rendered.text;
    } else if (!html && text) {
      html = undefined;
    }

    if (!html && !text) {
      throw new MailerConfigurationException('Mail body cannot be empty');
    }

    const attachments = await this.normalizeAttachments(input.attachments ?? []);

    return {
      to,
      subject,
      html,
      text: text ?? undefined,
      from,
      replyTo: this.normalizeReplyTo(input.replyTo),
      template: input.template,
      attachments,
      data: input.data,
    };
  }

  private resolveFrom(from: string | undefined, defaultFrom: string, allowFromOverride: boolean): string {
    if (!from) {
      return defaultFrom;
    }

    if (!allowFromOverride) {
      throw new MailerConfigurationException('Sender override is disabled by configuration');
    }

    const mailbox = parseMailbox(from);
    if (!isValidMailboxAddress(mailbox.address)) {
      throw new MailerInvalidRecipientException(from);
    }

    return mailbox.name ? `${mailbox.name} <${mailbox.address}>` : mailbox.address;
  }

  private normalizeReplyTo(replyTo: string | undefined): string | undefined {
    if (!replyTo) {
      return undefined;
    }

    const mailbox = parseMailbox(replyTo);
    if (!isValidMailboxAddress(mailbox.address)) {
      throw new MailerInvalidRecipientException(replyTo);
    }

    return mailbox.name ? `${mailbox.name} <${mailbox.address}>` : mailbox.address;
  }

  private async normalizeAttachments(
    attachments: PreparedMailMessage['attachments'],
  ): Promise<PreparedMailMessage['attachments']> {
    const normalized: PreparedMailMessage['attachments'] = [];

    for (const attachment of attachments) {
      if (attachment.path && !attachment.content) {
        const fileContent = await readFile(path.resolve(attachment.path));
        normalized.push({ ...attachment, content: fileContent });
        continue;
      }

      normalized.push(attachment);
    }

    return normalized;
  }
}
