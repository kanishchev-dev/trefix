import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';
import { MailerModule } from '@/modules/mailer/mailer.module';
import { StorageModule } from '@/modules/storage/storage.module';

import { UsersModule } from '../users.module';
import { DataExportCollector } from './data-export.collector';
import { DATA_EXPORT_QUEUE } from './data-export.constants';
import { DataExportController } from './data-export.controller';
import { DataExport } from './data-export.entity';
import { DataExportProcessor } from './data-export.processor';
import { DataExportService } from './data-export.service';

@Module({
  imports: [
    SequelizeModule.forFeature([DataExport]),
    BullModule.registerQueue({ name: DATA_EXPORT_QUEUE, defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS }),
    UsersModule,
    StorageModule,
    MailerModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportService, DataExportCollector, DataExportProcessor],
})
export class DataExportModule {}
