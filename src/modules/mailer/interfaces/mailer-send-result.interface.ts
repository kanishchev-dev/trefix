export interface MailerDeliveredResult {
  readonly queued: false;
  readonly messageId: string;
  readonly accepted: string[];
  readonly rejected: string[];
  readonly response: string;
}

export interface MailerQueuedResult {
  readonly queued: true;
  readonly jobId: string | null;
}

export type MailerSendResult = MailerDeliveredResult | MailerQueuedResult;
