import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { RealtimeModule } from '@/modules/realtime/realtime.module';

import { CoachPolicyService } from './coach-policy.service';
import { PreferencesListener } from './preferences.listener';
import { UserPreferencesController } from './user-preferences.controller';
import { UserPreferences } from './user-preferences.entity';
import { UserPreferencesService } from './user-preferences.service';

/** Per-user preferences and the coach policy built on them; imported by training and coach. */
@Module({
  imports: [SequelizeModule.forFeature([UserPreferences]), RealtimeModule],
  controllers: [UserPreferencesController],
  providers: [UserPreferencesService, CoachPolicyService, PreferencesListener],
  exports: [UserPreferencesService, CoachPolicyService],
})
export class PreferencesModule {}
