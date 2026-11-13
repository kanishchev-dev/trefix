import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';

import { AthletesService } from '@/modules/training/athletes/athletes.service';

import {
  DEVICE_PROVIDERS,
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUSES,
  WEBHOOK_EVENT_STATUSES,
} from './constants/integrations.constants';
import { IntegrationItemResponseDto, IntegrationsListResponseDto } from './dto/integration-response.dto';
import { DeviceSyncBatch } from './entities/device-sync-batch.entity';
import { Integration } from './entities/integration.entity';
import { WorkoutSource } from './entities/workout-source.entity';
import { toIntegrationItem } from './integration-item.mapper';

/**
 * Overview of every integration and its connection status for the user.
 */
@Injectable()
export class IntegrationsService {
  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    private readonly athletesService: AthletesService,
    private readonly configService: ConfigService,
    @InjectModel(WorkoutSource)
    private readonly workoutSourceModel: typeof WorkoutSource,
    @InjectModel(DeviceSyncBatch)
    private readonly deviceBatchModel: typeof DeviceSyncBatch,
  ) {}

  /** Lists every provider with its connection status for the user. */
  async listIntegrations(actorUserId: string): Promise<IntegrationsListResponseDto> {
    const athlete = await this.athletesService.getOrCreateAthlete(actorUserId);
    const integrations = await this.integrationModel.findAll({
      where: { athleteId: athlete.id },
    });
    const healthEnabled = this.configService.get<boolean>('integrations.health.enabled') === true;

    const items: IntegrationItemResponseDto[] = await Promise.all(
      INTEGRATION_PROVIDERS.map(async (provider) => {
        const found = integrations.find((entry) => entry.provider === provider) ?? null;
        const isDevice = (DEVICE_PROVIDERS as readonly string[]).includes(provider);
        const importedActivitiesCount = found
          ? await this.workoutSourceModel.count({ where: { athleteId: athlete.id, provider } })
          : 0;
        const pendingBatches =
          found && isDevice
            ? await this.deviceBatchModel.count({
                where: {
                  integrationId: found.id,
                  status: [WEBHOOK_EVENT_STATUSES.PENDING, WEBHOOK_EVENT_STATUSES.PROCESSING],
                },
              })
            : 0;
        return toIntegrationItem(provider, found, {
          importedActivitiesCount,
          pendingBatches,
          available: provider === 'garmin' ? false : isDevice ? healthEnabled : true,
        });
      }),
    );

    return { items };
  }

  /** Returns Strava integration details for the authenticated user. */
  async getStravaIntegration(actorUserId: string): Promise<IntegrationItemResponseDto> {
    const list = await this.listIntegrations(actorUserId);
    const strava = list.items.find((item) => item.provider === 'strava');
    if (!strava) {
      return {
        provider: 'strava',
        status: INTEGRATION_STATUSES.DISCONNECTED,
        connectedAt: null,
        lastSyncedAt: null,
        externalUserId: null,
        importedActivitiesCount: 0,
        profileAccess: false,
        lastProfileSyncAt: null,
        available: true,
        profileSync: null,
        pendingBatches: 0,
        scopes: [],
      };
    }
    return strava;
  }
}
