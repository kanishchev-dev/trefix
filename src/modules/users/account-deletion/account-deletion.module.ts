import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { StorageFile } from '@/modules/storage/entities/storage-file.entity';
import { StorageModule } from '@/modules/storage/storage.module';

import { User } from '../entities/user.entity';
import { ACCOUNT_DELETION_QUEUE } from '../users.constants';
import { UsersModule } from '../users.module';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionProcessor } from './account-deletion.processor';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [
    SequelizeModule.forFeature([User, StorageFile]),
    BullModule.registerQueue({ name: ACCOUNT_DELETION_QUEUE }),
    UsersModule,
    StorageModule,
  ],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService, AccountDeletionProcessor],
})
export class AccountDeletionModule {}
