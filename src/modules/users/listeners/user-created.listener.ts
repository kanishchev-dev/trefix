import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import { UserCreatedEvent } from '../events/user-created.event';

@Injectable()
export class UserCreatedListener {
  private readonly logger = new Logger(UserCreatedListener.name);

  constructor(
    @InjectQueue('user-onboarding')
    private readonly onboardingQueue: Queue,
  ) {}

  @OnEvent('user.created')
  async handleUserCreatedEvent(event: UserCreatedEvent): Promise<void> {
    this.logger.log(`Handling user.created event for user: ${event.email}`);

    // As per guidelines: listener puts task into queue for I/O heavy operations
    await this.onboardingQueue.add(
      'send-welcome-email',
      {
        userId: event.userId,
        email: event.email,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );
  }
}
