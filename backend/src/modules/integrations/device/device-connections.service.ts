import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { DomainUnprocessableException } from '@/common/exceptions/domain-exceptions';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { ImportedWorkoutLookupService } from '@/modules/training/workouts/imported-workout-lookup.service';

import { UserConsentsService } from '../../users/consents/user-consents.service';
import {
  DEVICE_PROVIDER_PLATFORMS,
  DEVICE_PROVIDERS,
  DEVICE_SYNC_HISTORY_DEFAULT_DAYS,
  INTEGRATION_STATUSES,
} from '../constants/integrations.constants';
import { IntegrationItemResponseDto } from '../dto/integration-response.dto';
import { DeviceSyncBatch } from '../entities/device-sync-batch.entity';
import { Integration } from '../entities/integration.entity';
import { WorkoutSource } from '../entities/workout-source.entity';
import { IntegrationConnectedEvent } from '../events/integration-connected.event';
import { IntegrationDisconnectedEvent } from '../events/integration-disconnected.event';
import { toIntegrationItem } from '../integration-item.mapper';
import { DeviceIntegrationLookup } from './device-integration-lookup.service';
import { DeviceMetadata, PENDING_STATUSES } from './device-integrations.shared';
import { DeviceConnectionDto, UpdateDeviceConnectionDto } from './dto/device-connection.dto';
import { WorkoutSourcesResponseDto } from './dto/device-sync-status.dto';

/**
 * Connecting and disconnecting Apple Health / Health Connect, and where a workout's records came from.
 */
@Injectable()
export class DeviceConnectionsService {
  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    @InjectModel(DeviceSyncBatch)
    private readonly batchModel: typeof DeviceSyncBatch,
    @InjectModel(WorkoutSource)
    private readonly sourceModel: typeof WorkoutSource,
    private readonly athletesService: AthletesService,
    private readonly workoutLookup: ImportedWorkoutLookupService,
    private readonly consentsService: UserConsentsService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly lookup: DeviceIntegrationLookup,
  ) {}

  async connect(userId: string, providerParam: string, dto: DeviceConnectionDto): Promise<IntegrationItemResponseDto> {
    const provider = this.lookup.resolveProvider(providerParam);
    if (DEVICE_PROVIDER_PLATFORMS[provider] !== dto.platform) {
      throw new DomainUnprocessableException(
        'PROVIDER_PLATFORM_MISMATCH',
        `${provider} is available only on ${DEVICE_PROVIDER_PLATFORMS[provider]}`,
      );
    }
    await this.consentsService.assertCurrent(userId, 'health_data');
    const athlete = await this.athletesService.getOrCreateAthlete(userId);

    let integration = await this.integrationModel.findOne({
      where: { athleteId: athlete.id, provider },
      paranoid: false,
    });
    if (integration?.deletedAt) {
      await integration.restore();
    }
    const wasConnected = !!integration && integration.status !== INTEGRATION_STATUSES.DISCONNECTED;
    const metadata: DeviceMetadata = {
      ...((integration?.metadata as DeviceMetadata | undefined) ?? {}),
      platform: dto.platform,
      osVersion: dto.osVersion,
      appVersion: dto.appVersion,
      lastDeviceId: dto.deviceId,
      historyDepthDays: dto.historyDepthDays ?? DEVICE_SYNC_HISTORY_DEFAULT_DAYS,
      profileSync: dto.profileSync ?? (integration?.metadata as DeviceMetadata | undefined)?.profileSync ?? true,
    };

    if (integration) {
      integration.metadata = metadata as Record<string, unknown>;
      integration.changed('metadata', true);
      integration.scopes = dto.grantedScopes ?? integration.scopes ?? [];
      if (!wasConnected) {
        integration.status = INTEGRATION_STATUSES.CONNECTED;
        integration.connectedAt = new Date();
        integration.disconnectedAt = null;
        integration.lastSyncError = null;
      }
      await integration.save();
    } else {
      integration = await this.integrationModel.create({
        athleteId: athlete.id,
        provider,
        status: INTEGRATION_STATUSES.CONNECTED,
        externalUserId: null,
        scopes: dto.grantedScopes ?? [],
        metadata,
        connectedAt: new Date(),
      });
    }

    if (!wasConnected) {
      this.eventEmitter.emit(
        INTEGRATIONS_EVENTS.CONNECTED,
        new IntegrationConnectedEvent(integration.id, athlete.id, provider),
      );
    }
    return this.toItem(integration);
  }

  async updateConnection(
    userId: string,
    providerParam: string,
    dto: UpdateDeviceConnectionDto,
  ): Promise<IntegrationItemResponseDto> {
    const provider = this.lookup.resolveProvider(providerParam);
    const integration = await this.lookup.loadConnected(userId, provider);
    const metadata: DeviceMetadata = { ...(integration.metadata as DeviceMetadata) };
    if (dto.profileSync !== undefined) {
      metadata.profileSync = dto.profileSync;
    }
    if (dto.osVersion !== undefined) {
      metadata.osVersion = dto.osVersion;
    }
    if (dto.appVersion !== undefined) {
      metadata.appVersion = dto.appVersion;
    }
    integration.metadata = metadata as Record<string, unknown>;
    integration.changed('metadata', true);
    if (dto.grantedScopes !== undefined) {
      integration.scopes = dto.grantedScopes;
    }
    await integration.save();
    return this.toItem(integration);
  }

  /** Already accepted batches are still processed; imported workouts stay. */
  async disconnect(userId: string, providerParam: string): Promise<{ success: boolean }> {
    const provider = this.lookup.resolveProvider(providerParam, { allowWhenDisabled: true });
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const integration = await this.integrationModel.findOne({ where: { athleteId: athlete.id, provider } });
    if (!integration) {
      throw new EntityNotFoundException('Integration', provider);
    }
    await this.markDisconnected(integration);
    return { success: true };
  }

  /** Health data consent revoked: both device providers stop accepting data. */
  async disconnectAllForUser(userId: string): Promise<number> {
    const athlete = await this.athletesService.findByUserId(userId);
    if (!athlete) {
      return 0;
    }
    const integrations = await this.integrationModel.findAll({
      where: {
        athleteId: athlete.id,
        provider: [...DEVICE_PROVIDERS],
        status: { [Op.ne]: INTEGRATION_STATUSES.DISCONNECTED },
      },
    });
    for (const integration of integrations) {
      await this.markDisconnected(integration);
    }
    return integrations.length;
  }

  async listWorkoutSources(userId: string, workoutId: string): Promise<WorkoutSourcesResponseDto> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const workout = await this.workoutLookup.findAthleteWorkout(athlete.id, workoutId);
    if (!workout) {
      throw new EntityNotFoundException('Workout', workoutId);
    }
    const sources = await this.sourceModel.findAll({
      where: { workoutId },
      order: [
        ['isPrimary', 'DESC'],
        ['createdAt', 'ASC'],
      ],
    });
    return {
      items: sources.map((source) => ({
        provider: source.provider,
        isPrimary: source.isPrimary,
        originDevice: source.originDevice,
        originAppId: source.originAppId,
        startedAt: source.startedAt,
      })),
    };
  }

  private async markDisconnected(integration: Integration): Promise<void> {
    if (integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      return;
    }
    integration.status = INTEGRATION_STATUSES.DISCONNECTED;
    integration.disconnectedAt = new Date();
    await integration.save();
    this.eventEmitter.emit(
      INTEGRATIONS_EVENTS.DISCONNECTED,
      new IntegrationDisconnectedEvent(integration.id, integration.athleteId, integration.provider),
    );
  }

  private async toItem(integration: Integration): Promise<IntegrationItemResponseDto> {
    const [importedActivitiesCount, pendingBatches] = await Promise.all([
      this.sourceModel.count({ where: { athleteId: integration.athleteId, provider: integration.provider } }),
      this.batchModel.count({ where: { integrationId: integration.id, status: PENDING_STATUSES } }),
    ]);
    return toIntegrationItem(integration.provider, integration, {
      importedActivitiesCount,
      pendingBatches,
      available: this.configService.get<boolean>('integrations.health.enabled') === true,
    });
  }
}
