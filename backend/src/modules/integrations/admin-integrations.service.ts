import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { DomainBadRequestException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { AthletesService } from '@/modules/training/athletes/athletes.service';

import { DEVICE_PROVIDERS, INTEGRATION_PROVIDERS } from './constants/integrations.constants';
import { DeviceConnectionsService } from './device/device-connections.service';
import { WorkoutSourcesResponseDto } from './device/dto/device-sync-status.dto';
import { IntegrationsListResponseDto } from './dto/integration-response.dto';
import { IntegrationSyncStatusResponseDto } from './dto/sync-status-response.dto';
import { WorkoutSource } from './entities/workout-source.entity';
import { WorkoutSourceUnlinkedEvent } from './events/workout-source-unlinked.event';
import { ActivityIngestionService } from './ingestion/activity-ingestion.service';
import { toIntegrationItem } from './integration-item.mapper';
import { INTEGRATIONS_EVENTS } from './integrations.events';
import { IntegrationsService } from './integrations.service';
import { WorkoutRecordingResponseDto } from './recordings/dto/recorded-activity.dto';
import { RecordingsService } from './recordings/recordings.service';
import { StravaActivitySyncService } from './strava/strava-activity-sync.service';
import { StravaConnectionService } from './strava/strava-connection.service';
import { StravaProfileSyncService } from './strava/strava-profile-sync.service';

/** Realtime event that asks the user's phone to run a Health sync in the background. */
export const DEVICE_SYNC_REQUESTED_EVENT = 'integrations.sync_requested';

/**
 * Integrations of any user from the admin panel. Connecting is not possible
 * here: OAuth consent and Health access are granted on the user's device.
 */
@Injectable()
export class AdminIntegrationsService {
  constructor(
    @InjectModel(WorkoutSource)
    private readonly sourceModel: typeof WorkoutSource,
    private readonly athletesService: AthletesService,
    private readonly integrationsService: IntegrationsService,
    private readonly stravaConnection: StravaConnectionService,
    private readonly stravaActivitySync: StravaActivitySyncService,
    private readonly stravaProfileSync: StravaProfileSyncService,
    private readonly deviceConnections: DeviceConnectionsService,
    private readonly ingestion: ActivityIngestionService,
    private readonly recordingsService: RecordingsService,
    private readonly realtimeService: RealtimeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Without an athlete profile every provider is simply not connected; no profile is created. */
  async list(userId: string): Promise<IntegrationsListResponseDto> {
    if (!(await this.athletesService.findByUserId(userId))) {
      return {
        items: INTEGRATION_PROVIDERS.map((provider) =>
          toIntegrationItem(provider, null, {
            importedActivitiesCount: 0,
            pendingBatches: 0,
            available: provider !== 'garmin',
          }),
        ),
      };
    }
    return this.integrationsService.listIntegrations(userId);
  }

  async syncStrava(userId: string): Promise<IntegrationSyncStatusResponseDto> {
    await this.requireAthlete(userId);
    return this.stravaActivitySync.triggerStravaSync(userId);
  }

  async syncStravaProfile(userId: string): Promise<{ status: 'queued' }> {
    await this.requireAthlete(userId);
    return this.stravaProfileSync.triggerStravaProfileSync(userId);
  }

  /** Health data can only be read on the phone, so the app is asked to sync the next time it is reachable. */
  async requestDeviceSync(userId: string, provider: string): Promise<{ delivered: boolean }> {
    await this.requireAthlete(userId);
    if (!(DEVICE_PROVIDERS as readonly string[]).includes(provider)) {
      throw new DomainBadRequestException('INTEGRATION_PROVIDER_INVALID', 'Only Health providers sync on the device');
    }
    const delivered = this.realtimeService.emitToUser(userId, DEVICE_SYNC_REQUESTED_EVENT, { provider });
    this.eventEmitter.emit(INTEGRATIONS_EVENTS.SYNC_REQUESTED, { userId, provider, delivered });
    return { delivered };
  }

  async disconnect(userId: string, provider: string): Promise<{ success: boolean }> {
    await this.requireAthlete(userId);
    if (provider === 'strava') {
      return this.stravaConnection.disconnectStrava(userId);
    }
    return this.deviceConnections.disconnect(userId, provider);
  }

  async listWorkoutSources(userId: string, workoutId: string): Promise<WorkoutSourcesResponseDto> {
    await this.requireAthlete(userId);
    return this.deviceConnections.listWorkoutSources(userId, workoutId);
  }

  /**
   * Detaches one provider record. The workout keeps the facts of the other
   * sources; with none left a plan workout goes back to planned and an ad-hoc
   * one is removed, exactly as when the provider deletes the record.
   */
  async unlinkWorkoutSource(userId: string, workoutId: string, provider: string): Promise<void> {
    const athleteId = await this.requireAthlete(userId);
    const source = await this.sourceModel.findOne({ where: { athleteId, workoutId, provider } });
    if (!source) {
      throw new DomainNotFoundException('WORKOUT_SOURCE_NOT_FOUND', 'The workout has no record from this provider');
    }
    await this.ingestion.removeSource(athleteId, provider, source.sourceActivityId);
    this.eventEmitter.emit(
      INTEGRATIONS_EVENTS.SOURCE_UNLINKED,
      new WorkoutSourceUnlinkedEvent(athleteId, workoutId, provider),
    );
  }

  async getRecording(userId: string, workoutId: string): Promise<WorkoutRecordingResponseDto> {
    await this.requireAthlete(userId);
    return this.recordingsService.getForWorkout(userId, workoutId);
  }

  private async requireAthlete(userId: string): Promise<string> {
    const athlete = await this.athletesService.findByUserId(userId);
    if (!athlete) {
      throw new DomainNotFoundException('ATHLETE_NOT_FOUND', `Athlete profile of user ${userId} not found`);
    }
    return athlete.id;
  }
}
