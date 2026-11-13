import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { decryptToken } from '../../../../common/utils/encryption.util';
import { STRAVA_ACTIVITY_SCOPES, STRAVA_PROFILE_SCOPE } from '../../constants/integrations.constants';
import { Integration } from '../../entities/integration.entity';
import { IntegrationReauthorizationRequiredException } from '../../exceptions/integration-reauthorization-required.exception';
import { IntegrationProvider, OAuthTokens } from '../../interfaces/integration-provider.interface';
import { RunningActivity } from '../../interfaces/running-activity.interface';
import { StravaMapper } from './strava.mapper';
import { StravaApiClient } from './strava-api.client';

@Injectable()
export class StravaProvider implements IntegrationProvider {
  readonly providerName = 'strava';
  private readonly logger = new Logger(StravaProvider.name);

  constructor(
    private readonly client: StravaApiClient,
    private readonly configService: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.configService.getOrThrow<string>('integrations.encryptionKey');
  }

  generateAuthUrl(athleteId: string, state: string): string {
    return this.client.generateAuthUrl(state);
  }

  /** Authorization URL that also asks for the athlete profile (weight, sex, shoes). */
  generateProfileAuthUrl(state: string): string {
    return this.client.generateAuthUrl(state, [...STRAVA_ACTIVITY_SCOPES, STRAVA_PROFILE_SCOPE], true);
  }

  /** Weight, sex and shoes with brand/model. Requires `profile:read_all`. */
  async fetchAthleteProfile(integration: Integration): Promise<{
    weightKg: number | null;
    sex: 'male' | 'female' | null;
    shoes: Array<{
      externalId: string;
      brand: string;
      model: string;
      nickname: string | null;
      distanceKm: number;
      retired: boolean;
    }>;
  }> {
    const accessToken = this.getAccessToken(integration);
    const athlete = await this.client.fetchAthlete(accessToken);
    const shoes = [];
    for (const summary of athlete.shoes ?? []) {
      let brand = '';
      let model = '';
      let retired = summary.retired ?? false;
      try {
        const detail = await this.client.fetchGear(accessToken, summary.id);
        brand = detail.brand_name?.trim() ?? '';
        model = detail.model_name?.trim() ?? '';
        retired = detail.retired ?? retired;
      } catch (error) {
        this.logger.warn(`Strava gear ${summary.id} details unavailable: ${error}`);
      }
      shoes.push({
        externalId: summary.id,
        brand: brand || summary.name,
        model: model || summary.name,
        nickname: summary.name && summary.name !== `${brand} ${model}`.trim() ? summary.name : null,
        distanceKm: Math.round((summary.distance / 1000) * 10) / 10,
        retired,
      });
    }
    return {
      weightKg: typeof athlete.weight === 'number' && athlete.weight > 0 ? Math.round(athlete.weight * 10) / 10 : null,
      sex: athlete.sex === 'M' ? 'male' : athlete.sex === 'F' ? 'female' : null,
      shoes,
    };
  }

  async exchangeCode(code: string, grantedScopes?: string[]): Promise<OAuthTokens> {
    const tokenRes = await this.client.exchangeCode(code);
    const expiresAt = new Date(tokenRes.expires_at * 1000);
    const externalUserId = tokenRes.athlete ? String(tokenRes.athlete.id) : '';

    return {
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      expiresAt,
      scopes: grantedScopes && grantedScopes.length > 0 ? grantedScopes : ['activity:read_all'],
      externalUserId,
    };
  }

  async refreshToken(currentRefreshToken: string): Promise<OAuthTokens> {
    const tokenRes = await this.client.refreshToken(currentRefreshToken);
    const expiresAt = new Date(tokenRes.expires_at * 1000);
    const externalUserId = tokenRes.athlete ? String(tokenRes.athlete.id) : '';

    return {
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      expiresAt,
      scopes: ['activity:read_all'],
      externalUserId,
    };
  }

  async fetchActivities(
    integration: Integration,
    options?: { page?: number; perPage?: number; after?: Date },
  ): Promise<RunningActivity[]> {
    const accessToken = this.getAccessToken(integration);
    const afterTimestamp = options?.after ? Math.floor(options.after.getTime() / 1000) : undefined;

    const stravaActivities = await this.client.fetchAthleteActivities(accessToken, {
      page: options?.page || 1,
      perPage: options?.perPage || 50,
      after: afterTimestamp,
    });

    return stravaActivities
      .filter((act) => StravaMapper.isSupportedActivity(act))
      .map((act) => StravaMapper.toRunningActivity(integration.athleteId, act));
  }

  async fetchActivity(integration: Integration, activityId: string): Promise<RunningActivity | null> {
    const accessToken = this.getAccessToken(integration);
    const stravaActivity = await this.client.fetchActivity(accessToken, activityId);

    if (!StravaMapper.isSupportedActivity(stravaActivity)) {
      return null;
    }

    return StravaMapper.toRunningActivity(integration.athleteId, stravaActivity);
  }

  async revokeAccess(integration: Integration): Promise<void> {
    if (!integration.accessTokenEncrypted) return;
    try {
      const accessToken = decryptToken(integration.accessTokenEncrypted, this.encryptionKey);
      await this.client.deauthorize(accessToken);
    } catch (err) {
      this.logger.warn(`Failed to deauthorize Strava access for integration ${integration.id}: ${err}`);
    }
  }

  private getAccessToken(integration: Integration): string {
    if (!integration.accessTokenEncrypted) {
      throw new IntegrationReauthorizationRequiredException();
    }
    return decryptToken(integration.accessTokenEncrypted, this.encryptionKey);
  }
}
