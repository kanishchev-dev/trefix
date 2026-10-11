import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';

import mailerConfig from './config/mailer.config';
import { MAILER_QUEUE_NAME, MAILER_TRANSPORT } from './mailer.constants';
import { MailerService } from './mailer.service';
import { MailerProcessor } from './processors/mailer.processor';
import { MailerComposerService } from './services/mailer-composer.service';
import { MailerTemplateService } from './services/mailer-template.service';
import { SmtpMailerTransport } from './transports/smtp-mailer.transport';

@Module({
  imports: [
    ConfigModule.forFeature(mailerConfig),
    BullModule.registerQueue({
      name: MAILER_QUEUE_NAME,
      defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
    }),
  ],
  providers: [
    MailerService,
    MailerComposerService,
    MailerTemplateService,
    MailerProcessor,
    SmtpMailerTransport,
    {
      provide: MAILER_TRANSPORT,
      useExisting: SmtpMailerTransport,
    },
  ],
  exports: [MailerService],
})
export class MailerModule {}
