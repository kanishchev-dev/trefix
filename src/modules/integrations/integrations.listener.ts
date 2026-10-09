import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AccountDeletionRequestedEvent } from '../users/account-deletion/account-deletion-requested.event';
import { IntegrationsService } from './integrations.service';

@Injectable()
export class IntegrationsListener {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /** Awaited by account deletion: tokens must be revoked before the data is gone. */
  @OnEvent('account.deletion_requested', { promisify: true })
  async handleAccountDeletion(event: AccountDeletionRequestedEvent): Promise<void> {
    await this.integrationsService.revokeAllForUser(event.userId);
  }
}
