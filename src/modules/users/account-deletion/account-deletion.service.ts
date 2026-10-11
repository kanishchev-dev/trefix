import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';

import { ForbiddenActionException } from '@/common/exceptions/domain-exceptions';
import { StorageService } from '@/modules/storage/storage.service';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { User } from '../entities/user.entity';
import { ACCOUNT_DELETION_DELAY_MS, ACCOUNT_DELETION_JOB, ACCOUNT_DELETION_QUEUE } from '../users.constants';
import { UsersService } from '../users.service';
import { AccountDeletionRequestedEvent } from './account-deletion-requested.event';

export interface AccountPurgeJobData {
  userId: string;
}

/**
 * Self-service account deletion. The account is deactivated at once (sessions
 * revoked, Strava access revoked); all data is physically removed by a queued
 * job well within 24 hours. There is no restore.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectQueue(ACCOUNT_DELETION_QUEUE)
    private readonly queue: Queue<AccountPurgeJobData>,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestDeletion(userId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      return;
    }
    if (user.isSystem) {
      throw new ForbiddenActionException('ACCOUNT_DELETION_FORBIDDEN', 'System accounts cannot be deleted');
    }

    // External access is revoked while tokens are still readable.
    await this.eventEmitter.emitAsync(
      USERS_EVENTS.ACCOUNT_DELETION_REQUESTED,
      new AccountDeletionRequestedEvent(userId),
    );
    // Soft delete + `user.deleted`: every session is revoked by the auth listener.
    await this.usersService.remove(userId);
    await this.queue.add(
      ACCOUNT_DELETION_JOB,
      { userId },
      {
        jobId: `account-purge:${userId}`,
        delay: ACCOUNT_DELETION_DELAY_MS,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
      },
    );
    this.logger.log(`Account deletion requested; purge scheduled for user ${userId}`);
  }

  /** Physically deletes the user; database rows cascade from `users`, files are removed from storage. */
  async purge(userId: string): Promise<void> {
    await this.storageService.deleteAllUploadedBy(userId);

    const user = await this.userModel.findByPk(userId, { paranoid: false });
    if (!user) {
      return;
    }
    if (!user.deletedAt) {
      // Deletion was cancelled by an admin restore; keep the account.
      this.logger.warn(`Skipping purge of user ${userId}: the account is active`);
      return;
    }
    await user.destroy({ force: true });
    this.logger.log(`Account purged: ${userId}`);
  }
}
