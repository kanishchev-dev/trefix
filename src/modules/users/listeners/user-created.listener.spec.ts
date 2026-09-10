import { MailerService } from '@/modules/mailer/mailer.service';
import { RealtimeService } from '@/modules/realtime/realtime.service';

import { UserCreatedEvent } from '../events/user-created.event';
import { UserCreatedListener } from './user-created.listener';

describe('UserCreatedListener', () => {
  const mailerService = {
    send: jest.fn().mockResolvedValue(undefined),
  } as unknown as MailerService;

  const realtimeService = {
    emitToRoom: jest.fn(),
  } as unknown as RealtimeService;

  let listener: UserCreatedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new UserCreatedListener(mailerService, realtimeService);
  });

  it('sends the welcome email and publishes a realtime user.created event', async () => {
    const event = new UserCreatedEvent('user-1', 'user@example.com', 'John', 'Doe');

    await listener.handleUserCreatedEvent(event);

    expect(mailerService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Welcome to Trefix',
        template: 'users/welcome',
      }),
    );
    expect(realtimeService.emitToRoom).toHaveBeenCalledWith('users', 'user.created', event);
  });
});
