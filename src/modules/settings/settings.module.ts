import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { PermissionsModule } from '@/modules/permissions/permissions.module';
import { RealtimeModule } from '@/modules/realtime/realtime.module';

import { AppSetting } from './entities/app-setting.entity';
import { SettingsListener } from './listeners/settings.listener';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [SequelizeModule.forFeature([AppSetting]), RealtimeModule, PermissionsModule],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsListener],
  exports: [SettingsService],
})
export class SettingsModule {}
