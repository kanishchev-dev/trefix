import { AuthSessionRevokedEvent } from '@/modules/auth/events/auth-session-revoked.event';

import { RealtimeService } from '../realtime.service';
import { SessionRevokedListener } from './session-revoked.listener';

describe('SessionRevokedListener', () => {
  const realtimeService = {
    disconnectSession: jest.fn().mockReturnValue(true),
  };

  let listener: SessionRevokedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new SessionRevokedListener(realtimeService as unknown as RealtimeService);
  });

  it.each<AuthSessionRevokedEvent['reason']>(['logout', 'logout-all', 'password-reset', 'user-deleted'])(
    'drops the sockets of a session revoked by %s',
    (reason) => {
      listener.handleSessionRevoked(new AuthSessionRevokedEvent('user-1', 'session-1', reason));

      expect(realtimeService.disconnectSession).toHaveBeenCalledWith('session-1');
    },
  );

  it('does not throw when the gateway is not up yet', () => {
    realtimeService.disconnectSession.mockReturnValue(false);

    expect(() =>
      listener.handleSessionRevoked(new AuthSessionRevokedEvent('user-1', 'session-1', 'logout')),
    ).not.toThrow();
  });

  it('targets the session rather than the whole user', () => {
    const otherSession = new AuthSessionRevokedEvent('user-1', 'session-2', 'refresh-reuse');

    listener.handleSessionRevoked(otherSession);

    expect(realtimeService.disconnectSession).toHaveBeenCalledWith('session-2');
    expect(realtimeService.disconnectSession).not.toHaveBeenCalledWith('session-1');
  });
});