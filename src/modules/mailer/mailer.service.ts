import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { MailerSendInput } from './interfaces/mailer-send-input.interface';
import { MailerSendResult } from './interfaces/mailer-send-result.interface';
import { PreparedMailMessage } from './interfaces/prepared-mail-message.interface';
import {
  MAILER_DEFAULT_QUEUE_ATTEMPTS,
  MAILER_DEFAULT_QUEUE_BACKOFF_DELAY_MS,
  MAILER_QUEUE_JOB_SEND,
  MAILER_QUEUE_NAME,
  MAILER_TRANSPORT,
} from './mailer.constants';
import { MailerComposerService } from './services/mailer-composer.service';
import { SmtpMailerTransport } from './transports/smtp-mailer.transport';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly composerService: MailerComposerService,
    @Inject(MAILER_TRANSPORT)
    private readonly transport: SmtpMailerTransport,
    @InjectQueue(MAILER_QUEUE_NAME)
    private readonly queue: Queue<PreparedMailMessage>,
  ) {}

  async send(input: MailerSendInput): Promise<MailerSendResult> {
    const defaultFrom = this.buildDefaultSender();
    const allowFromOverride = this.configService.get<boolean>('mailer.allowFromOverride') ?? false;
    const preparedMessage = await this.composerService.compose(input, defaultFrom, allowFromOverride);
    const useQueue = this.configService.get<boolean>('mailer.useQueue') ?? false;

    if (useQueue) {
      const job = await this.queue.add(MAILER_QUEUE_JOB_SEND, preparedMessage, {
        attempts: MAILER_DEFAULT_QUEUE_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: MAILER_DEFAULT_QUEUE_BACKOFF_DELAY_MS,
        },
      });

      this.logger.log(
        `Queued email for ${preparedMessage.to.join(', ')} using ${preparedMessage.template ?? 'raw'} template`,
      );

      return {
        queued: true,
        jobId: job.id ? String(job.id) : null,
      };
    }

    this.logger.log(
      `Sending email to ${preparedMessage.to.join(', ')} using ${preparedMessage.template ?? 'raw'} template`,
    );
    const result = await this.transport.send(preparedMessage);
    this.logger.log(`Email sent to ${preparedMessage.to.join(', ')} with messageId ${result.messageId}`);

    return {
      queued: false,
      ...result,
    };
  }

  private buildDefaultSender(): string {
    const fromName = this.configService.get<string>('mailer.fromName') ?? 'Application';
    const fromEmail = this.configService.getOrThrow<string>('mailer.from');
    return `${fromName} <${fromEmail}>`;
  }
}
