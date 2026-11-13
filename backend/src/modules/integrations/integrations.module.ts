import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';

import { RealtimeModule } from '../realtime/realtime.module';
import { StorageModule } from '../storage/storage.module';
import { TrainingModule } from '../training/training.module';
import { ConsentsModule } from '../users/consents/consents.module';
import { PreferencesModule } from '../users/preferences/preferences.module';
import { AdminIntegrationsController } from './admin-integrations.controller';
import { AdminIntegrationsService } from './admin-integrations.service';
import integrationsConfig from './config/integrations.config';
import { INTEGRATIONS_QUEUE_NAME } from './constants/integrations.constants';
import { DeviceConnectionsService } from './device/device-connections.service';
import { DeviceIntegrationLookup } from './device/device-integration-lookup.service';
import { DeviceIntegrationsController } from './device/device-integrations.controller';
import { DeviceIntegrationsListener } from './device/device-integrations.listener';
import { DeviceProfileMetricsService } from './device/device-profile-metrics.service';
import { DeviceSyncService } from './device/device-sync.service';
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
import { StravaActivitySyncService } from './strava/strava-activity-sync.service';
import { StravaConnectionService } from './strava/strava-connection.service';
import { StravaProfileSyncService } from './strava/strava-profile-sync.service';
import { StravaTokenService } from './strava/strava-token.service';

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
  controllers: [
    IntegrationsController,
    DeviceIntegrationsController,
    RecordingsController,
    AdminIntegrationsController,
  ],
  providers: [
    StravaApiClient,
    StravaProvider,
    ActivityDedupService,
    ActivityIngestionService,
    IntegrationsService,
    StravaTokenService,
    StravaConnectionService,
    StravaProfileSyncService,
    StravaActivitySyncService,
    IntegrationsProcessor,
    IntegrationsScheduler,
    IntegrationsListener,
    DeviceIntegrationLookup,
    DeviceConnectionsService,
    DeviceSyncService,
    DeviceProfileMetricsService,
    DeviceIntegrationsListener,
    RecordingsService,
    OAuthStateStore,
    AdminIntegrationsService,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
