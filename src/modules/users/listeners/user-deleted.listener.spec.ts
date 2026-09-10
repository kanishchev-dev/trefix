import { RealtimeService } from '@/modules/realtime/realtime.service';

import { UserDeletedEvent } from '../events/user-deleted.event';
import { UserDeletedListener } from './user-deleted.listener';

describe('UserDeletedListener', () => {
  const realtimeService = {
    emitToUser: jest.fn(),
    emitToRoom: jest.fn(),
  } as unknown as RealtimeService;

  let listener: UserDeletedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new UserDeletedListener(realtimeService);
  });

  it('publishes user.deleted to the user and users room', () => {
    const event = new UserDeletedEvent('user-1');

    listener.handleUserDeletedEvent(event);

    expect(realtimeService.emitToUser).toHaveBeenCalledWith('user-1', 'user.deleted', event);
    expect(realtimeService.emitToRoom).toHaveBeenCalledWith('users', 'user.deleted', event);
  });
});
