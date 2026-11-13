import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { S3StorageAdapter } from './adapters/s3-storage.adapter';
import storageConfig from './config/storage.config';
import { StorageFile } from './entities/storage-file.entity';
import { StorageListener } from './listeners/storage.listener';
import { STORAGE_ADAPTER } from './storage.constants';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule.forFeature(storageConfig), SequelizeModule.forFeature([StorageFile])],
  controllers: [StorageController],
  providers: [
    StorageService,
    StorageListener,
    {
      provide: STORAGE_ADAPTER,
      useClass: S3StorageAdapter,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
