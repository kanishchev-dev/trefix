import { randomUUID } from 'crypto';

import { MailAttachment, MailAttachmentContent } from '../interfaces/mailer-attachment.interface';
import { PreparedMailMessage } from '../interfaces/prepared-mail-message.interface';
import { parseMailbox, sanitizeHeaderValue } from './mailer-address.util';

function encodeMimeWord(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function formatAddress(address: string): string {
  const mailbox = parseMailbox(address);

  if (!mailbox.name) {
    return mailbox.address;
  }

  return `${encodeMimeWord(sanitizeHeaderValue(mailbox.name))} <${mailbox.address}>`;
}

function normalizeContent(content: MailAttachmentContent | undefined, encoding?: BufferEncoding): Buffer {
  if (Buffer.isBuffer(content)) {
    return content;
  }

  if (typeof content === 'string') {
    return Buffer.from(content, encoding ?? 'utf8');
  }

  if (content && content.type === 'Buffer' && Array.isArray(content.data)) {
    return Buffer.from(content.data);
  }

  return Buffer.alloc(0);
}

function toBase64Lines(buffer: Buffer): string {
  return (
    buffer
      .toString('base64')
      .match(/.{1,76}/g)
      ?.join('\r\n') ?? ''
  );
}

function buildTextPart(content: string, contentType: string): string {
  return [`Content-Type: ${contentType}; charset="UTF-8"`, 'Content-Transfer-Encoding: 8bit', '', content].join('\r\n');
}

function buildAttachmentPart(attachment: MailAttachment): string {
  const filename = sanitizeHeaderValue(attachment.filename);
  const contentType = attachment.contentType || 'application/octet-stream';
  const content = normalizeContent(attachment.content, attachment.encoding);
  const disposition = attachment.cid ? 'inline' : 'attachment';

  return [
    `Content-Type: ${contentType}; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: ${disposition}; filename="${filename}"`,
    attachment.cid ? `Content-ID: <${sanitizeHeaderValue(attachment.cid)}>` : undefined,
    '',
    toBase64Lines(content),
  ]
    .filter((line) => typeof line === 'string')
    .join('\r\n');
}

function buildAlternativeParts(
  text: string | undefined,
  html: string | undefined,
): { contentType: string; body: string } {
  const boundary = `alt-${randomUUID()}`;
  const parts: string[] = [];

  if (text) {
    parts.push(`--${boundary}`);
    parts.push(buildTextPart(text, 'text/plain'));
  }

  if (html) {
    parts.push(`--${boundary}`);
    parts.push(buildTextPart(html, 'text/html'));
  }

  parts.push(`--${boundary}--`);

  return {
    contentType: `multipart/alternative; boundary="${boundary}"`,
    body: parts.join('\r\n'),
  };
}

function buildAlternativePart(text: string | undefined, html: string | undefined): string {
  const { contentType, body } = buildAlternativeParts(text, html);
  return [`Content-Type: ${contentType}`, '', body].join('\r\n');
}

function buildMixedBody(message: PreparedMailMessage): { contentType: string; body: string } {
  const hasAttachments = message.attachments.length > 0;
  const hasHtml = Boolean(message.html);
  const hasText = Boolean(message.text);

  if (!hasAttachments && hasHtml && hasText) {
    const alternative = buildAlternativeParts(message.text, message.html);
    return {
      contentType: alternative.contentType,
      body: alternative.body,
    };
  }

  if (!hasAttachments) {
    if (hasHtml) {
      return {
        contentType: 'text/html; charset="UTF-8"',
        body: message.html ?? '',
      };
    }

    return {
      contentType: 'text/plain; charset="UTF-8"',
      body: message.text ?? '',
    };
  }

  const mixedBoundary = `mix-${randomUUID()}`;
  const parts: string[] = [];

  if (hasHtml && hasText) {
    parts.push(`--${mixedBoundary}`);
    parts.push(buildAlternativePart(message.text, message.html));
  } else if (hasHtml) {
    parts.push(`--${mixedBoundary}`);
    parts.push(buildTextPart(message.html ?? '', 'text/html'));
  } else {
    parts.push(`--${mixedBoundary}`);
    parts.push(buildTextPart(message.text ?? '', 'text/plain'));
  }

  for (const attachment of message.attachments) {
    parts.push(`--${mixedBoundary}`);
    parts.push(buildAttachmentPart(attachment));
  }

  parts.push(`--${mixedBoundary}--`);

  return {
    contentType: `multipart/mixed; boundary="${mixedBoundary}"`,
    body: parts.join('\r\n'),
  };
}

export function buildRawMessage(message: PreparedMailMessage, messageIdDomain: string): string {
  const { contentType, body } = buildMixedBody(message);
  const dateHeader = new Date().toUTCString();
  const messageId = `<${randomUUID()}@${messageIdDomain}>`;
  const toHeader = message.to.map((recipient) => formatAddress(recipient)).join(', ');

  const headers = [
    `Date: ${dateHeader}`,
    `Message-ID: ${messageId}`,
    `From: ${formatAddress(message.from)}`,
    `To: ${toHeader}`,
    `Subject: ${encodeMimeWord(sanitizeHeaderValue(message.subject))}`,
    `X-Mailer: Trefix Mailer`,
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}`,
  ];

  if (message.replyTo) {
    headers.splice(4, 0, `Reply-To: ${formatAddress(message.replyTo)}`);
  }

  return `${headers.join('\r\n')}\r\n\r\n${body}`;
}

export function dotStuffBody(body: string): string {
  return body.replace(/(^|\r\n)\./g, '$1..');
}
