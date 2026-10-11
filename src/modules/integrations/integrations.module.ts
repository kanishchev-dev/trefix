import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';

import { RealtimeModule } from '../realtime/realtime.module';
import { StorageModule } from '../storage/storage.module';
import { Athlete } from '../training/entities/athlete.entity';
import { Workout } from '../training/entities/workout.entity';
import { TrainingModule } from '../training/training.module';
import { ConsentsModule } from '../users/consents/consents.module';
import { PreferencesModule } from '../users/preferences/preferences.module';
import integrationsConfig from './config/integrations.config';
import { INTEGRATIONS_QUEUE_NAME } from './constants/integrations.constants';
import { DeviceIntegrationsController } from './device/device-integrations.controller';
import { DeviceIntegrationsListener } from './device/device-integrations.listener';
import { DeviceIntegrationsService } from './device/device-integrations.service';
import { DeviceSyncBatch } from './entities/device-sync-batch.entity';
import { Integration } from './entities/integration.entity';
import { IntegrationSyncState } from './entities/integration-sync-state.entity';
import { StravaWebhookEvent } from './entities/strava-webhook-event.entity';
import { WorkoutSource } from './entities/workout-source.entity';
import { ActivityDedupService } from './ingestion/activity-dedup.service';
import { ActivityIngestionService } from './ingestion/activity-ingestion.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsListener } from './integrations.listener';
import { IntegrationsScheduler } from './integrations.scheduler';
import { IntegrationsService } from './integrations.service';
import { IntegrationsProcessor } from './processors/integrations.processor';
import { StravaProvider } from './providers/strava/strava.provider';
import { StravaApiClient } from './providers/strava/strava-api.client';
import { RecordedActivity } from './recordings/recorded-activity.entity';
import { RecordingsController } from './recordings/recordings.controller';
import { RecordingsService } from './recordings/recordings.service';
import { OAuthStateStore } from './services/oauth-state.store';

@Module({
  imports: [
    ConfigModule.forFeature(integrationsConfig),
    SequelizeModule.forFeature([
      Integration,
      IntegrationSyncState,
      StravaWebhookEvent,
      WorkoutSource,
      DeviceSyncBatch,
      RecordedActivity,
      Workout,
      Athlete,
    ]),
    BullModule.registerQueue({
      name: INTEGRATIONS_QUEUE_NAME,
      defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
    }),
    TrainingModule,
    PreferencesModule,
    ConsentsModule,
    RealtimeModule,
    StorageModule,
  ],
  // Order matters: static `strava/*` routes must be registered before `:provider/*`.
  controllers: [IntegrationsController, DeviceIntegrationsController, RecordingsController],
  providers: [
    StravaApiClient,
    StravaProvider,
    ActivityDedupService,
    ActivityIngestionService,
    IntegrationsService,
    IntegrationsProcessor,
    IntegrationsScheduler,
    IntegrationsListener,
    DeviceIntegrationsService,
    DeviceIntegrationsListener,
    RecordingsService,
    OAuthStateStore,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
