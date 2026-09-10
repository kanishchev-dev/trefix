import { isEmail } from 'class-validator';

export interface ParsedMailbox {
  readonly name?: string;
  readonly address: string;
}

export function normalizeRecipients(value: string | string[]): string[] {
  const rawRecipients = Array.isArray(value) ? value : value.split(',');
  const normalized = rawRecipients.map((recipient) => recipient.trim()).filter((recipient) => recipient.length > 0);

  return [...new Set(normalized)];
}

export function parseMailbox(value: string): ParsedMailbox {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*)<([^<>]+)>$/);

  if (!match) {
    return { address: trimmed };
  }

  const rawName = match[1].trim().replace(/^"|"$/g, '');
  const address = match[2].trim();

  return rawName ? { name: rawName, address } : { address };
}

export function isValidMailboxAddress(value: string): boolean {
  return isEmail(value.trim());
}

export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
