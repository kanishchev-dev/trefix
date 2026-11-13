import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { TrainingModule } from '@/modules/training/training.module';
import { PreferencesModule } from '@/modules/users/preferences/preferences.module';
import { UsersModule } from '@/modules/users/users.module';

import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from './admin-overview.service';

/** Read-only summary of a user across domains; only composes exported services. */
@Module({
  imports: [UsersModule, AuthModule, TrainingModule, IntegrationsModule, PreferencesModule],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService],
})
export class AdminOverviewModule {}
