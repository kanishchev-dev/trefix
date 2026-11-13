import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';

import { DomainConflictException } from '@/common/exceptions/domain-exceptions';
import { decryptToken, encryptToken } from '@/common/utils/encryption.util';

import { INTEGRATION_STATUSES, OAUTH_ACCESS_TOKEN_REFRESH_MARGIN_MS } from '../constants/integrations.constants';
import { Integration } from '../entities/integration.entity';
import { IntegrationReauthorizationRequiredException } from '../exceptions/integration-reauthorization-required.exception';
import { StravaProvider } from '../providers/strava/strava.provider';

/**
 * The athlete's Strava connection record: lookup, encrypted OAuth tokens and their refresh.
 */
@Injectable()
export class StravaTokenService {
  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    private readonly stravaProvider: StravaProvider,
    private readonly configService: ConfigService,
  ) {}

  /** Tokens as stored at rest; the key comes from `INTEGRATIONS_ENCRYPTION_KEY`. */
  encrypt(tokens: { accessToken: string; refreshToken: string }): {
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
  } {
    return {
      accessTokenEncrypted: encryptToken(tokens.accessToken, this.encryptionKey),
      refreshTokenEncrypted: encryptToken(tokens.refreshToken, this.encryptionKey),
    };
  }

  private get encryptionKey(): string {
    return this.configService.getOrThrow<string>('integrations.encryptionKey');
  }

  /**
   * Makes sure the access token stays valid for a while, refreshing it if not.
   *
   * Strava rotates the refresh token on every refresh, so two jobs refreshing
   * the same connection at once would leave one of them with a revoked token.
   * The integration row is locked for the refresh: whoever waits for the lock
   * finds the token already refreshed and reuses it.
   */
  async ensureValidAccessToken(integration: Integration): Promise<void> {
    if (this.isAccessTokenFresh(integration)) {
      return;
    }
    if (!integration.refreshTokenEncrypted) {
      integration.status = INTEGRATION_STATUSES.REAUTHORIZATION_REQUIRED;
      await integration.save();
      throw new IntegrationReauthorizationRequiredException();
    }

    await this.integrationModel.sequelize!.transaction(async (transaction) => {
      const locked = await this.integrationModel.findByPk(integration.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!locked?.refreshTokenEncrypted) {
        throw new IntegrationReauthorizationRequiredException();
      }
      if (!this.isAccessTokenFresh(locked)) {
        const currentRefreshToken = decryptToken(locked.refreshTokenEncrypted, this.encryptionKey);
        const newTokens = await this.stravaProvider.refreshToken(currentRefreshToken);
        locked.accessTokenEncrypted = encryptToken(newTokens.accessToken, this.encryptionKey);
        locked.refreshTokenEncrypted = encryptToken(newTokens.refreshToken, this.encryptionKey);
        locked.accessTokenExpiresAt = newTokens.expiresAt;
        await locked.save({ transaction });
      }
      integration.accessTokenEncrypted = locked.accessTokenEncrypted;
      integration.refreshTokenEncrypted = locked.refreshTokenEncrypted;
      integration.accessTokenExpiresAt = locked.accessTokenExpiresAt;
    });
  }

  private isAccessTokenFresh(integration: Integration): boolean {
    return (
      integration.accessTokenExpiresAt !== null &&
      integration.accessTokenExpiresAt !== undefined &&
      integration.accessTokenExpiresAt.getTime() > Date.now() + OAUTH_ACCESS_TOKEN_REFRESH_MARGIN_MS
    );
  }

  async loadConnectedStravaOrThrow(athleteId: string): Promise<Integration> {
    const integration = await this.integrationModel.findOne({ where: { athleteId, provider: 'strava' } });
    if (!integration || integration.status === INTEGRATION_STATUSES.DISCONNECTED) {
      throw new DomainConflictException('STRAVA_NOT_CONNECTED', 'Connect Strava first');
    }
    return integration;
  }
}
