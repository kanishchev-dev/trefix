import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { decryptToken } from '../../../../common/utils/encryption.util';
import { Integration } from '../../entities/integration.entity';
import {
  IntegrationProvider,
  OAuthTokens,
} from '../../interfaces/integration-provider.interface';
import { RunningActivity } from '../../interfaces/running-activity.interface';
import { StravaApiClient } from './strava-api.client';
import { StravaMapper } from './strava.mapper';

@Injectable()
export class StravaProvider implements IntegrationProvider {
  readonly providerName = 'strava';
  private readonly logger = new Logger(StravaProvider.name);

  constructor(
    private readonly client: StravaApiClient,
    private readonly configService: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.configService.get<string>('integrations.encryptionKey') || '';
  }

  generateAuthUrl(athleteId: string, state: string): string {
    return this.client.generateAuthUrl(state);
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const tokenRes = await this.client.exchangeCode(code);
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
      .filter((act) => StravaMapper.isRunningActivity(act))
      .map((act) => StravaMapper.toRunningActivity(integration.athleteId, act));
  }

  async fetchActivity(
    integration: Integration,
    activityId: string,
  ): Promise<RunningActivity | null> {
    const accessToken = this.getAccessToken(integration);
    const stravaActivity = await this.client.fetchActivity(accessToken, activityId);

    if (!StravaMapper.isRunningActivity(stravaActivity)) {
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
      throw new Error('Integration has no encrypted access token');
    }
    return decryptToken(integration.accessTokenEncrypted, this.encryptionKey);
  }
}
