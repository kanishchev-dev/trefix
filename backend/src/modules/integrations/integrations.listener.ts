import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { StravaConnectionService } from '@/modules/integrations/strava/strava-connection.service';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { AccountDeletionRequestedEvent } from '../users/account-deletion/account-deletion-requested.event';

@Injectable()
export class IntegrationsListener {
  constructor(private readonly stravaConnection: StravaConnectionService) {}

  /** Awaited by account deletion: tokens must be revoked before the data is gone. */
  @OnEvent(USERS_EVENTS.ACCOUNT_DELETION_REQUESTED, { promisify: true })
  async handleAccountDeletion(event: AccountDeletionRequestedEvent): Promise<void> {
    await this.stravaConnection.revokeAllForUser(event.userId);
  }
}
