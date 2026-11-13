import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { DomainException } from '@/common/exceptions/domain.exception';

import { PreparedMailMessage } from '../interfaces/prepared-mail-message.interface';
import { MAILER_QUEUE_NAME, MAILER_TRANSPORT } from '../mailer.constants';
import { SmtpMailerTransport } from '../transports/smtp-mailer.transport';

@Processor(MAILER_QUEUE_NAME)
@Injectable()
export class MailerProcessor extends WorkerHost {
  private readonly logger = new Logger(MailerProcessor.name);

  constructor(
    @Inject(MAILER_TRANSPORT)
    private readonly transport: SmtpMailerTransport,
  ) {
    super();
  }

  async process(job: Job<PreparedMailMessage>): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    response: string;
  }> {
    this.logger.debug(
      `Processing mail job ${job.id ?? 'unknown'} for ${job.data.to.join(', ')} using ${job.data.template ?? 'raw'}`,
    );

    return this.transport.send(job.data);
  }

  @OnWorkerEvent('failed')
  handleFailed(job: Job<PreparedMailMessage> | undefined, error: Error, prev: string): void {
    const jobId = job?.id ?? 'unknown';
    if (error instanceof DomainException) {
      const status = error.getStatus();
      if (status >= 500) {
        this.logger.error(`Mail job ${jobId} failed after ${prev}: ${error.code} - ${error.message}`, error.stack);
        return;
      }

      this.logger.warn(`Mail job ${jobId} failed after ${prev}: ${error.code} - ${error.message}`);
      return;
    }

    this.logger.error(`Mail job ${jobId} failed after ${prev}: ${error.message}`, error.stack);
  }
}
