import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STRAVA_ACTIVITY_SCOPES } from '../../constants/integrations.constants';
import { IntegrationProviderRequestFailedException } from '../../exceptions/integration-provider-request-failed.exception';
import {
  StravaActivitySummary,
  StravaDetailedAthlete,
  StravaDetailedGear,
  StravaTokenResponse,
} from '../../interfaces/strava-api.interface';

@Injectable()
export class StravaApiClient {
  private readonly logger = new Logger(StravaApiClient.name);

  constructor(private readonly configService: ConfigService) {}

  private get clientId(): string {
    return this.configService.getOrThrow<string>('integrations.strava.clientId');
  }

  private get clientSecret(): string {
    return this.configService.getOrThrow<string>('integrations.strava.clientSecret');
  }

  private get redirectUri(): string {
    return this.configService.getOrThrow<string>('integrations.strava.redirectUri');
  }

  private get apiBaseUrl(): string {
    return this.configService.getOrThrow<string>('integrations.strava.apiBaseUrl');
  }

  private get oauthBaseUrl(): string {
    return this.configService.getOrThrow<string>('integrations.strava.oauthBaseUrl');
  }

  /** Generates Strava OAuth authorization URL. `force` shows the consent screen again to grant new scopes. */
  generateAuthUrl(state: string, scopes: readonly string[] = STRAVA_ACTIVITY_SCOPES, force = false): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      approval_prompt: force ? 'force' : 'auto',
      scope: scopes.join(','),
      state,
    });

    return `${this.oauthBaseUrl}/authorize?${params.toString()}`;
  }

  /** Exchanges authorization code for access and refresh tokens. */
  async exchangeCode(code: string): Promise<StravaTokenResponse> {
    const response = await fetch(`${this.oauthBaseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Strava token exchange failed: ${response.status} ${errorText}`);
      throw new IntegrationProviderRequestFailedException('Strava', 'token exchange', response.status);
    }

    return (await response.json()) as StravaTokenResponse;
  }

  /** Refreshes expired access token. */
  async refreshToken(refreshToken: string): Promise<StravaTokenResponse> {
    const response = await fetch(`${this.oauthBaseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Strava token refresh failed: ${response.status} ${errorText}`);
      throw new IntegrationProviderRequestFailedException('Strava', 'token refresh', response.status);
    }

    return (await response.json()) as StravaTokenResponse;
  }

  /** Fetches list of activities for authenticated athlete. */
  async fetchAthleteActivities(
    accessToken: string,
    params?: { page?: number; perPage?: number; after?: number; before?: number },
  ): Promise<StravaActivitySummary[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.perPage) query.append('per_page', String(params.perPage));
    if (params?.after) query.append('after', String(params.after));
    if (params?.before) query.append('before', String(params.before));

    const url = `${this.apiBaseUrl}/athlete/activities?${query.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Strava fetch activities failed: ${response.status} ${errorText}`);
      throw new IntegrationProviderRequestFailedException('Strava', 'fetch activities', response.status);
    }

    return (await response.json()) as StravaActivitySummary[];
  }

  /** Fetches details for a single activity. */
  async fetchActivity(accessToken: string, activityId: string): Promise<StravaActivitySummary> {
    const url = `${this.apiBaseUrl}/activities/${activityId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Strava fetch activity ${activityId} failed: ${response.status} ${errorText}`);
      throw new IntegrationProviderRequestFailedException('Strava', 'fetch activity', response.status);
    }

    return (await response.json()) as StravaActivitySummary;
  }

  /** The authenticated athlete; weight, sex and shoes need `profile:read_all`. */
  async fetchAthlete(accessToken: string): Promise<StravaDetailedAthlete> {
    return this.getJson<StravaDetailedAthlete>(accessToken, '/athlete');
  }

  /** Brand and model of a piece of gear. */
  async fetchGear(accessToken: string, gearId: string): Promise<StravaDetailedGear> {
    return this.getJson<StravaDetailedGear>(accessToken, `/gear/${encodeURIComponent(gearId)}`);
  }

  private async getJson<T>(accessToken: string, path: string): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Strava GET ${path} failed: ${response.status} ${errorText}`);
      throw new IntegrationProviderRequestFailedException('Strava', `GET ${path}`, response.status);
    }
    return (await response.json()) as T;
  }

  /** Revokes integration access / token. */
  async deauthorize(accessToken: string): Promise<void> {
    try {
      await fetch(`${this.oauthBaseUrl}/deauthorize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      this.logger.warn(`Failed to call Strava deauthorize: ${error}`);
    }
  }
}
