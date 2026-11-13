import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  EXPO_PUSH_CHUNK_SIZE,
  EXPO_PUSH_RECEIPTS_URL,
  EXPO_PUSH_SEND_URL,
  EXPO_RECEIPTS_CHUNK_SIZE,
} from '../notifications.constants';

export interface ExpoPushMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/** Raised for transport failures and 5xx/429 answers, so the job is retried. */
export class ExpoPushTransportError extends Error {}

/** Thin client of the Expo push service: https://docs.expo.dev/push-notifications/sending-notifications/ */
@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);

  constructor(private readonly configService: ConfigService) {}

  static isExpoToken(token: string): boolean {
    return /^Expo(nent)?PushToken\[.+\]$/.test(token);
  }

  /** Tickets come back in the order of `messages`. */
  async send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const tickets: ExpoPushTicket[] = [];
    for (let index = 0; index < messages.length; index += EXPO_PUSH_CHUNK_SIZE) {
      const chunk = messages.slice(index, index + EXPO_PUSH_CHUNK_SIZE);
      const body = await this.post<{ data?: ExpoPushTicket[] }>(EXPO_PUSH_SEND_URL, chunk);
      tickets.push(...(body.data ?? []));
    }
    return tickets;
  }

  async receipts(ids: string[]): Promise<Record<string, ExpoPushReceipt>> {
    const receipts: Record<string, ExpoPushReceipt> = {};
    for (let index = 0; index < ids.length; index += EXPO_RECEIPTS_CHUNK_SIZE) {
      const chunk = ids.slice(index, index + EXPO_RECEIPTS_CHUNK_SIZE);
      const body = await this.post<{ data?: Record<string, ExpoPushReceipt> }>(EXPO_PUSH_RECEIPTS_URL, {
        ids: chunk,
      });
      Object.assign(receipts, body.data ?? {});
    }
    return receipts;
  }

  private async post<T>(url: string, payload: unknown): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate',
      'content-type': 'application/json',
    };
    const accessToken = this.configService.get<string>('notifications.expoAccessToken');
    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`;
    }
    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    } catch (error) {
      throw new ExpoPushTransportError(`Expo push request failed: ${(error as Error).message}`);
    }
    if (response.status === 429 || response.status >= 500) {
      throw new ExpoPushTransportError(`Expo push service answered ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as T & { errors?: Array<{ message?: string }> };
    if (!response.ok) {
      // 4xx means the request itself is wrong; retrying the same payload will not help.
      this.logger.error(`Expo push rejected the request (${response.status}): ${JSON.stringify(body.errors ?? body)}`);
      throw new Error(`Expo push rejected the request with ${response.status}`);
    }
    return body;
  }
}
