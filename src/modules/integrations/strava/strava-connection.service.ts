import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { AthletesService } from '@/modules/training/athletes/athletes.service';

import {
  INTEGRATION_STATUSES,
  INTEGRATIONS_QUEUE_NAME,
  JOB_STRAVA_INITIAL_SYNC,
  STRAVA_PROFILE_SCOPE,
  SYNC_STATUSES,
  SYNC_TYPES,
} from '../constants/integrations.constants';
import { StravaConnectResponseDto } from '../dto/strava-connect-response.dto';
import { Integration } from '../entities/integration.entity';
import { IntegrationSyncState } from '../entities/integration-sync-state.entity';
import { IntegrationConnectedEvent } from '../events/integration-connected.event';
import { IntegrationDisconnectedEvent } from '../events/integration-disconnected.event';
import { IntegrationOAuthStateInvalidException } from '../exceptions/integration-oauth-state-invalid.exception';
import { StravaProvider } from '../providers/strava/strava.provider';
import { OAuthStateStore } from '../services/oauth-state.store';
import { StravaProfileSyncService } from './strava-profile-sync.service';
import { StravaTokenService } from './strava-token.service';

/**
 * Connecting, re-authorizing and disconnecting Strava.
 */
@Injectable()
export class StravaConnectionService {
  constructor(
    @InjectModel(Integration)
    private readonly integrationModel: typeof Integration,
    @InjectModel(IntegrationSyncState)
    private readonly syncStateModel: typeof IntegrationSyncState,
    @InjectQueue(INTEGRATIONS_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly stravaProvider: StravaProvider,
    private readonly athletesService: AthletesService,
    private readonly eventEmitter: EventEmitter2,
    private readonly oauthStateStore: OAuthStateStore,
    private readonly stravaProfileSyncService: StravaProfileSyncService,
    private readonly stravaTokenService: StravaTokenService,
  ) {}

  /** Initiates Strava OAuth connection flow. */
  async initiateStravaConnect(actorUserId: string): Promise<StravaConnectResponseDto> {
    const athlete = await this.athletesService.getOrCreateAthlete(actorUserId);
    const state = await this.oauthStateStore.issue({ athleteId: athlete.id, purpose: 'connect' });
    const authUrl = this.stravaProvider.generateAuthUrl(athlete.id, state);

    return { authUrl, state };
  }

  /** Re-authorization URL that adds `profile:read_all` (weight, sex, shoes) to an existing connection. */
  async requestStravaProfileAccess(actorUserId: string): Promise<{ authorizeUrl: string; state: string }> {
    const athlete = await this.athletesService.getOrCreateAthlete(actorUserId);
    await this.stravaTokenService.loadConnectedStravaOrThrow(athlete.id);
    const state = await this.oauthStateStore.issue({ athleteId: athlete.id, purpose: 'profile' });
    return { authorizeUrl: this.stravaProvider.generateProfileAuthUrl(state), state };
  }

  /** Revokes Strava access of a user whose account is being deleted. */
  async revokeAllForUser(userId: string): Promise<void> {
    const athlete = await this.athletesService.findByUserId(userId);
    if (!athlete) {
      return;
    }
    const integrations = await this.integrationModel.findAll({ where: { athleteId: athlete.id } });
    for (const integration of integrations) {
      if (integration.provider === 'strava') {
        await this.stravaProvider.revokeAccess(integration);
      }
      integration.status = INTEGRATION_STATUSES.DISCONNECTED;
      integration.disconnectedAt = new Date();
      integration.accessTokenEncrypted = null;
      integration.refreshTokenEncrypted = null;
      await integration.save();
    }
  }

  /** Handles OAuth callback from Strava. */
  async handleStravaCallback(
    code: string,
    state: string,
    grantedScope?: string,
  ): Promise<{ success: boolean; message: string }> {
    const stored = await this.oauthStateStore.consume(state);
    if (!stored) {
      throw new IntegrationOAuthStateInvalidException();
    }

    const grantedScopes = grantedScope
      ? grantedScope
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean)
      : undefined;
    const tokens = await this.stravaProvider.exchangeCode(code, grantedScopes);
    const athleteId = stored.athleteId;

    let integration = await this.integrationModel.findOne({
      where: { athleteId, provider: 'strava' },
      paranoid: false,
    });

    const { accessTokenEncrypted: encryptedAccessToken, refreshTokenEncrypted: encryptedRefreshToken } =
      this.stravaTokenService.encrypt(tokens);

    if (integration) {
      if (integration.deletedAt) {
        await integration.restore();
      }
      integration.status = INTEGRATION_STATUSES.CONNECTED;
      integration.externalUserId = tokens.externalUserId;
      integration.accessTokenEncrypted = encryptedAccessToken;
      integration.refreshTokenEncrypted = encryptedRefreshToken;
      integration.accessTokenExpiresAt = tokens.expiresAt;
      integration.scopes = tokens.scopes;
      integration.connectedAt = new Date();
      integration.disconnectedAt = null;
      integration.lastSyncError = null;
      await integration.save();
    } else {
      integration = await this.integrationModel.create({
        athleteId,
        provider: 'strava',
        status: INTEGRATION_STATUSES.CONNECTED,
        externalUserId: tokens.externalUserId,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        accessTokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        connectedAt: new Date(),
      });
    }

    if (tokens.scopes.includes(STRAVA_PROFILE_SCOPE)) {
      await this.stravaProfileSyncService.enqueueProfileSync(integration.id);
    }
    if (stored.purpose === 'profile') {
      // Only the scope changed: activities are already imported.
      return { success: true, message: 'Strava profile access granted.' };
    }

    // Create sync state record
    await this.syncStateModel.create({
      integrationId: integration.id,
      syncType: SYNC_TYPES.INITIAL,
      startedAt: new Date(),
      status: SYNC_STATUSES.IN_PROGRESS,
    });

    // Enqueue initial sync job
    await this.queue.add(
      JOB_STRAVA_INITIAL_SYNC,
      { integrationId: integration.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.eventEmitter.emit(
      INTEGRATIONS_EVENTS.CONNECTED,
      new IntegrationConnectedEvent(integration.id, athleteId, 'strava'),
    );

    return {
      success: true,
      message: 'Strava connected successfully. Historical sync started in background.',
    };
  }

  /** Disconnects Strava integration for an athlete user. */
  async disconnectStrava(actorUserId: string): Promise<{ success: boolean }> {
    const athlete = await this.athletesService.getOrCreateAthlete(actorUserId);
    const integration = await this.integrationModel.findOne({
      where: { athleteId: athlete.id, provider: 'strava' },
    });

    if (!integration) {
      throw new EntityNotFoundException('Integration', 'strava');
    }

    await this.stravaProvider.revokeAccess(integration);

    integration.status = INTEGRATION_STATUSES.DISCONNECTED;
    integration.disconnectedAt = new Date();
    integration.accessTokenEncrypted = null;
    integration.refreshTokenEncrypted = null;
    await integration.save();

    this.eventEmitter.emit(
      INTEGRATIONS_EVENTS.DISCONNECTED,
      new IntegrationDisconnectedEvent(integration.id, athlete.id, 'strava'),
    );

    return { success: true };
  }
}
