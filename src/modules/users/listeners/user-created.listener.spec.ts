import { Queue } from 'bullmq';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { UserCreatedEvent } from '../events/user-created.event';
import { UserCreatedListener } from './user-created.listener';

describe('UserCreatedListener', () => {
  const queue = {
    add: jest.fn().mockResolvedValue(undefined),
  } as unknown as Queue;

  const realtimeService = {
    emitToRoom: jest.fn(),
  } as unknown as RealtimeService;

  let listener: UserCreatedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new UserCreatedListener(queue, realtimeService);
  });

  it('enqueues onboarding work and publishes a realtime user.created event', async () => {
    const event = new UserCreatedEvent('user-1', 'user@example.com');

    await listener.handleUserCreatedEvent(event);

    expect(queue.add).toHaveBeenCalledWith(
      'send-welcome-email',
      { userId: 'user-1', email: 'user@example.com' },
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }),
    );
    expect(realtimeService.emitToRoom).toHaveBeenCalledWith('users', 'user.created', event);
  });
});
