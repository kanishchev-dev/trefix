import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { MailerModule } from '@/modules/mailer/mailer.module';

import { AccountDeletionModule } from '../account-deletion/account-deletion.module';
import { ConsentsModule } from '../consents/consents.module';
import { DataExportModule } from '../data-export/data-export.module';
import { User } from '../entities/user.entity';
import { PreferencesModule } from '../preferences/preferences.module';
import { UsersModule } from '../users.module';
import { AdminAccountController } from './admin-account.controller';
import { AdminAccountService } from './admin-account.service';

@Module({
  imports: [
    SequelizeModule.forFeature([User]),
    UsersModule,
    PreferencesModule,
    ConsentsModule,
    AccountDeletionModule,
    DataExportModule,
    MailerModule,
  ],
  controllers: [AdminAccountController],
  providers: [AdminAccountService],
})
export class AdminAccountModule {}
