import { Integration } from '../entities/integration.entity';
import { RunningActivity } from './running-activity.interface';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  externalUserId: string;
}

export interface IntegrationProvider {
  readonly providerName: string;

  generateAuthUrl(athleteId: string, state: string): string;

  exchangeCode(code: string): Promise<OAuthTokens>;

  refreshToken(currentRefreshToken: string): Promise<OAuthTokens>;

  fetchActivities(
    integration: Integration,
    options?: { page?: number; perPage?: number; after?: Date },
  ): Promise<RunningActivity[]>;

  fetchActivity(integration: Integration, activityId: string): Promise<RunningActivity | null>;

  revokeAccess(integration: Integration): Promise<void>;
}
