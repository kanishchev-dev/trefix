import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as net from 'net';
import * as os from 'os';
import * as tls from 'tls';

import { MailerPermanentDeliveryException } from '../exceptions/mailer-permanent-delivery.exception';
import { MailerRateLimitException } from '../exceptions/mailer-rate-limit.exception';
import { MailerTemporaryDeliveryException } from '../exceptions/mailer-temporary-delivery.exception';
import { MailerTransportConnectionException } from '../exceptions/mailer-transport-connection.exception';
import { PreparedMailMessage } from '../interfaces/prepared-mail-message.interface';
import { SmtpResponse } from '../interfaces/smtp-response.interface';
import { buildRawMessage, dotStuffBody } from '../utils/mailer-mime.util';
import { SmtpSession } from './smtp-session';

interface MailerTransportConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly secure: boolean;
  readonly fromEmail: string;
  readonly rejectUnauthorized: boolean;
}

@Injectable()
export class SmtpMailerTransport {
  private readonly logger = new Logger(SmtpMailerTransport.name);

  constructor(private readonly configService: ConfigService) {}

  async send(message: PreparedMailMessage): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    response: string;
  }> {
    const config = this.getConfig();
    const socket = await this.createSocket(config);
    const session = new SmtpSession(socket, config.host, config.rejectUnauthorized);

    try {
      await session.expectGreeting();
      let response = await session.sendCommand(`EHLO ${this.getEhloHostname()}`);

      if (!config.secure && this.supportsStartTls(response)) {
        response = await session.sendCommand('STARTTLS');
        this.assertResponseRange(response, 220, 220, 'STARTTLS failed');
        await session.upgradeToTls();
        response = await session.sendCommand(`EHLO ${this.getEhloHostname()}`);
      }

      await this.authenticate(session, config);
      await this.sendEnvelope(session, message);

      const rawMessage = buildRawMessage(message, this.getMessageDomain(config.fromEmail));
      const dataResponse = await session.sendCommand('DATA');
      this.assertResponseRange(dataResponse, 354, 354, 'SMTP server refused message data');

      const deliveryResponse = await session.sendData(dotStuffBody(rawMessage));
      this.assertResponseRange(deliveryResponse, 250, 299, 'SMTP delivery failed');

      const messageId = `<${randomUUID()}@${this.getMessageDomain(config.fromEmail)}>`;
      this.logger.debug(`SMTP accepted message ${messageId}`);

      return {
        messageId,
        accepted: [...message.to],
        rejected: [],
        response: deliveryResponse.message,
      };
    } catch (error) {
      throw this.mapError(error);
    } finally {
      try {
        await session.quit();
      } catch {
        session.destroy();
      }
    }
  }

  private async createSocket(config: MailerTransportConfig): Promise<net.Socket | tls.TLSSocket> {
    try {
      if (config.secure) {
        return await new Promise<tls.TLSSocket>((resolve, reject) => {
          const socket = tls.connect(
            {
              host: config.host,
              port: config.port,
              servername: config.host,
              rejectUnauthorized: config.rejectUnauthorized,
            },
            () => resolve(socket),
          );

          socket.once('error', reject);
        });
      }

      return await new Promise<net.Socket>((resolve, reject) => {
        const socket = net.connect(
          {
            host: config.host,
            port: config.port,
          },
          () => resolve(socket),
        );

        socket.once('error', reject);
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private async authenticate(session: SmtpSession, config: MailerTransportConfig): Promise<void> {
    const authResponse = await session.sendCommand('AUTH LOGIN');
    this.assertResponseRange(authResponse, 334, 334, 'SMTP AUTH LOGIN rejected');

    const usernameResponse = await session.sendCommand(Buffer.from(config.user, 'utf8').toString('base64'));
    this.assertResponseRange(usernameResponse, 334, 334, 'SMTP username was rejected');

    const passwordResponse = await session.sendCommand(Buffer.from(config.password, 'utf8').toString('base64'));
    this.assertResponseRange(passwordResponse, 235, 235, 'SMTP authentication failed');
  }

  private async sendEnvelope(session: SmtpSession, message: PreparedMailMessage): Promise<void> {
    const mailFromResponse = await session.sendCommand(`MAIL FROM:<${this.extractAddress(message.from)}>`);
    this.assertResponseRange(mailFromResponse, 250, 299, 'MAIL FROM rejected');

    for (const recipient of message.to) {
      const rcptResponse = await session.sendCommand(`RCPT TO:<${this.extractAddress(recipient)}>`);
      this.assertResponseRange(rcptResponse, 250, 299, 'RCPT TO rejected');
    }
  }

  private supportsStartTls(response: SmtpResponse): boolean {
    return response.lines.some((line) => line.toUpperCase().includes('STARTTLS'));
  }

  private assertResponseRange(response: SmtpResponse, min: number, max: number, message: string): void {
    if (response.code >= min && response.code <= max) {
      return;
    }

    throw this.createSmtpError(response, message);
  }

  private createSmtpError(response: SmtpResponse, message: string): Error {
    if ([429, 452, 454].includes(response.code)) {
      return new MailerRateLimitException(`${message}: ${response.message}`);
    }

    if (response.code >= 400 && response.code <= 499) {
      return new MailerTemporaryDeliveryException(`${message}: ${response.message}`);
    }

    return new MailerPermanentDeliveryException(`${message}: ${response.message}`);
  }

  private getConfig(): MailerTransportConfig {
    return {
      host: this.configService.getOrThrow<string>('mailer.host'),
      port: this.configService.getOrThrow<number>('mailer.port'),
      user: this.configService.getOrThrow<string>('mailer.user'),
      password: this.configService.getOrThrow<string>('mailer.password'),
      secure: this.configService.get<boolean>('mailer.secure') ?? false,
      fromEmail: this.configService.getOrThrow<string>('mailer.from'),
      rejectUnauthorized: true,
    };
  }

  private getEhloHostname(): string {
    return os.hostname() || 'localhost';
  }

  private getMessageDomain(fromEmail: string): string {
    const domain = fromEmail.split('@')[1];
    return domain || 'localhost';
  }

  private extractAddress(address: string): string {
    const match = address.match(/<([^<>]+)>/);
    return match ? match[1].trim() : address.trim();
  }

  private mapError(error: unknown): Error {
    if (error instanceof MailerRateLimitException || error instanceof MailerTemporaryDeliveryException) {
      return error;
    }

    if (error instanceof MailerPermanentDeliveryException) {
      return error;
    }

    if (error instanceof Error) {
      if (
        ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE'].includes(
          (error as NodeJS.ErrnoException).code || '',
        )
      ) {
        return new MailerTransportConnectionException(error.message);
      }

      return new MailerTransportConnectionException(error.message);
    }

    return new MailerTransportConnectionException(String(error));
  }
}
