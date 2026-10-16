import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { Op } from 'sequelize';

import { DomainConflictException } from '@/common/exceptions/domain-exceptions';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { GearImportResultDto } from '@/modules/training/gear/dto/gear.dto';

import { AthleteProfileService } from '../../training/athletes/athlete-profile.service';
import { GearService } from '../../training/gear/gear.service';
import { UserPreferencesService } from '../../users/preferences/user-preferences.service';
import {
  INTEGRATION_STATUSES,
  INTEGRATIONS_QUEUE_NAME,
  JOB_STRAVA_PROFILE_SYNC,
  STRAVA_PROFILE_SCOPE,
} from '../constants/integrations.constants';
import { Integration } from '../entities/integration.entity';
import { StravaProvider } from '../providers/strava/strava.provider';
import { StravaTokenService } from './strava-token.service';

/**
 * Weight, sex and shoes pulled from the Strava profile when the user granted profile access.
 */
@Injectable()
export class StravaProfileSyncService {
  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    @InjectQueue(INTEGRATIONS_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly stravaProvider: StravaProvider,
    private readonly athletesService: AthletesService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly gearService: GearService,
    private readonly preferencesService: UserPreferencesService,
    private readonly stravaTokenService: StravaTokenService,
  ) {}

  /** Queues a profile sync outside of the daily schedule. */
  async triggerStravaProfileSync(actorUserId: string): Promise<{ status: 'queued' }> {
    const athlete = await this.athletesService.getOrCreateAthlete(actorUserId);
    const integration = await this.stravaTokenService.loadConnectedStravaOrThrow(athlete.id);
    if (!this.hasProfileScope(integration)) {
      throw new DomainConflictException('STRAVA_PROFILE_ACCESS_REQUIRED', 'Allow Strava to share your profile first');
    }
    await this.enqueueProfileSync(integration.id);
    return { status: 'queued' };
  }

  /**
   * Imports shoes from Strava right away (the user tapped "Import from Strava")
   * and reports what was added or updated. Works regardless of profile sync preference.
   */
  async importStravaShoes(actorUserId: string): Promise<GearImportResultDto> {
    const athlete = await this.athletesService.getOrCreateAthlete(actorUserId);
    const integration = await this.stravaTokenService.loadConnectedStravaOrThrow(athlete.id);
    if (!this.hasProfileScope(integration)) {
      throw new DomainConflictException('STRAVA_PROFILE_ACCESS_REQUIRED', 'Allow Strava to share your profile first');
    }
    await this.stravaTokenService.ensureValidAccessToken(integration);
    const profile = await this.stravaProvider.fetchAthleteProfile(integration);
    const result = await this.gearService.upsertExternalShoes(athlete.id, profile.shoes);
    return {
      created: result.created.length,
      updated: result.updated.length,
      unchanged: result.unchanged,
      items: await this.gearService.getMany(athlete.id, [...result.created, ...result.updated]),
    };
  }

  /**
   * Pulls weight, sex and shoes from Strava. Fields the user edited by hand
   * are left alone; nothing happens when profile sync is off in preferences.
   */
  async syncStravaProfile(integrationId: string): Promise<void> {
    const integration = await this.integrationModel.findByPk(integrationId);
    if (
      !integration ||
      integration.status === INTEGRATION_STATUSES.DISCONNECTED ||
      !this.hasProfileScope(integration)
    ) {
      return;
    }
    const athlete = await this.athletesService.findById(integration.athleteId);
    if (!athlete) {
      return;
    }
    const preferences = await this.preferencesService.getEntity(athlete.userId);
    if (!preferences.stravaProfileSync && !preferences.stravaGearSync) {
      return;
    }

    await this.stravaTokenService.ensureValidAccessToken(integration);
    const profile = await this.stravaProvider.fetchAthleteProfile(integration);
    if (preferences.stravaProfileSync) {
      await this.athleteProfileService.applySourcedValues(athlete.id, 'strava', {
        weightKg: profile.weightKg ?? undefined,
        sex: profile.sex ?? undefined,
      });
    }
    if (preferences.stravaGearSync) {
      await this.gearService.upsertExternalShoes(athlete.id, profile.shoes);
    }

    integration.lastProfileSyncAt = new Date();
    await integration.save();
  }

  /** Daily job: queues a profile sync for every Strava connection that granted profile access. */
  async syncAllStravaProfiles(): Promise<number> {
    const integrations = await this.integrationModel.findAll({
      where: { provider: 'strava', status: { [Op.ne]: INTEGRATION_STATUSES.DISCONNECTED } },
      attributes: ['id', 'scopes'],
    });
    const eligible = integrations.filter((integration) => this.hasProfileScope(integration));
    for (const integration of eligible) {
      await this.enqueueProfileSync(integration.id);
    }
    return eligible.length;
  }

  private hasProfileScope(integration: Integration): boolean {
    return Array.isArray(integration.scopes) && integration.scopes.includes(STRAVA_PROFILE_SCOPE);
  }

  async enqueueProfileSync(integrationId: string): Promise<void> {
    await this.queue.add(
      JOB_STRAVA_PROFILE_SYNC,
      { integrationId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
    );
  }
}
