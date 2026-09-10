import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { MailerService } from '@/modules/mailer/mailer.service';
import { RealtimeService } from '@/modules/realtime/realtime.service';

import { UserCreatedEvent } from '../events/user-created.event';

@Injectable()
export class UserCreatedListener {
  private readonly logger = new Logger(UserCreatedListener.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @OnEvent('user.created')
  async handleUserCreatedEvent(event: UserCreatedEvent): Promise<void> {
    this.logger.log(`Handling user.created event for user: ${event.email}`);

    await this.mailerService.send({
      to: event.email,
      subject: 'Welcome to Trefix',
      template: 'users/welcome',
      data: {
        firstName: event.firstName,
        lastName: event.lastName,
        email: event.email,
      },
    });

    this.realtimeService.emitToRoom('users', 'user.created', event);
  }
}
