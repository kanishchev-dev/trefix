import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { Athlete } from '../training/entities/athlete.entity';
import { Workout } from '../training/entities/workout.entity';
import { TrainingModule } from '../training/training.module';
import { PreferencesModule } from '../users/preferences/preferences.module';
import integrationsConfig from './config/integrations.config';
import { INTEGRATIONS_QUEUE_NAME } from './constants/integrations.constants';
import { Integration } from './entities/integration.entity';
import { IntegrationSyncState } from './entities/integration-sync-state.entity';
import { StravaWebhookEvent } from './entities/strava-webhook-event.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsListener } from './integrations.listener';
import { IntegrationsScheduler } from './integrations.scheduler';
import { IntegrationsService } from './integrations.service';
import { IntegrationsProcessor } from './processors/integrations.processor';
import { StravaProvider } from './providers/strava/strava.provider';
import { StravaApiClient } from './providers/strava/strava-api.client';

@Module({
  imports: [
    ConfigModule.forFeature(integrationsConfig),
    SequelizeModule.forFeature([Integration, IntegrationSyncState, StravaWebhookEvent, Workout, Athlete]),
    BullModule.registerQueue({
      name: INTEGRATIONS_QUEUE_NAME,
    }),
    TrainingModule,
    PreferencesModule,
  ],
  controllers: [IntegrationsController],
  providers: [
    StravaApiClient,
    StravaProvider,
    IntegrationsService,
    IntegrationsProcessor,
    IntegrationsScheduler,
    IntegrationsListener,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
