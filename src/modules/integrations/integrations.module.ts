import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { Workout } from '../training/entities/workout.entity';
import { TrainingModule } from '../training/training.module';
import integrationsConfig from './config/integrations.config';
import { INTEGRATIONS_QUEUE_NAME } from './constants/integrations.constants';
import { Integration } from './entities/integration.entity';
import { IntegrationSyncState } from './entities/integration-sync-state.entity';
import { StravaWebhookEvent } from './entities/strava-webhook-event.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsProcessor } from './processors/integrations.processor';
import { StravaApiClient } from './providers/strava/strava-api.client';
import { StravaProvider } from './providers/strava/strava.provider';

@Module({
  imports: [
    ConfigModule.forFeature(integrationsConfig),
    SequelizeModule.forFeature([Integration, IntegrationSyncState, StravaWebhookEvent, Workout]),
    BullModule.registerQueue({
      name: INTEGRATIONS_QUEUE_NAME,
    }),
    TrainingModule,
  ],
  controllers: [IntegrationsController],
  providers: [
    StravaApiClient,
    StravaProvider,
    IntegrationsService,
    IntegrationsProcessor,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
