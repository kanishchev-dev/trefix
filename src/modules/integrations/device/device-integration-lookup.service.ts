import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';

import { DomainConflictException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { AthletesService } from '@/modules/training/athletes/athletes.service';

import { DEVICE_PROVIDERS, type DeviceProviderName, INTEGRATION_STATUSES } from '../constants/integrations.constants';
import { Integration } from '../entities/integration.entity';

/**
 * Resolves a device provider for the request and the user's live connection to it.
 */
@Injectable()
export class DeviceIntegrationLookup {
  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    private readonly athletesService: AthletesService,
    private readonly configService: ConfigService,
  ) {}

  resolveProvider(value: string, options: { allowWhenDisabled?: boolean } = {}): DeviceProviderName {
    if (!(DEVICE_PROVIDERS as readonly string[]).includes(value)) {
      throw new DomainNotFoundException('PROVIDER_NOT_SUPPORTED', `Provider ${value} is not supported here`);
    }
    if (!options.allowWhenDisabled && this.configService.get<boolean>('integrations.health.enabled') !== true) {
      throw new DomainNotFoundException(
        'PROVIDER_NOT_SUPPORTED',
        'Apple Health and Health Connect are not available yet',
      );
    }
    return value as DeviceProviderName;
  }

  async loadConnected(userId: string, provider: DeviceProviderName): Promise<Integration> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const integration = await this.integrationModel.findOne({ where: { athleteId: athlete.id, provider } });
    if (!integration || integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      throw new DomainConflictException('INTEGRATION_NOT_CONNECTED', `Connect ${provider} first`);
    }
    return integration;
  }
}
