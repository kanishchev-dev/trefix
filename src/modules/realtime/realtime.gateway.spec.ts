import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';

import { AuthRedisService } from '@/modules/auth/services/auth-redis.service';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { RealtimePresenceService } from './services/realtime-presence.service';

jest.mock('@nestjs/websockets', () => ({
  ConnectedSocket: (): (() => undefined) => (): undefined => undefined,
  MessageBody: (): (() => undefined) => (): undefined => undefined,
  OnGatewayConnection: (): (() => undefined) => (): undefined => undefined,
  OnGatewayDisconnect: (): (() => undefined) => (): undefined => undefined,
  OnGatewayInit: (): (() => undefined) => (): undefined => undefined,
  SubscribeMessage: (): (() => undefined) => (): undefined => undefined,
  WebSocketGateway: (): (() => undefined) => (): undefined => undefined,
  WsException: class WsException extends Error {
    private readonly errorPayload: unknown;

    constructor(error: unknown) {
      super(
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message)
          : String(error),
      );
      this.errorPayload = error;
    }

    getError(): unknown {
      return this.errorPayload;
    }
  },
}));

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;

  const mockRealtimeService = {
    attachServer: jest.fn(),
    getUserRoom: jest.fn((userId: string) => `user:${userId}`),
    getRoom: jest.fn((room: string) => `room:${room}`),
    getSessionRoom: jest.fn((sessionId: string) => `session:${sessionId}`),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockPermissionsService = {
    getEffectivePermissions: jest.fn().mockResolvedValue([]),
  };

  const mockAuthRedisService = {
    getSession: jest.fn(),
  };

  const mockPresenceService = {
    connect: jest.fn(),
    touch: jest.fn(),
    disconnect: jest.fn(),
  };

  const ACCESS_TOKEN_PAYLOAD = { sub: 'user-1', tokenType: 'access', sessionId: 'session-1' };

  const createClient = (overrides: Partial<Socket> = {}): Socket =>
    ({
      id: 'socket-1',
      data: {},
      handshake: {
        auth: {},
        headers: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    }) as Socket;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => (key === 'JWT_ACCESS_SECRET' ? 'secret' : undefined));
    mockAuthRedisService.getSession.mockResolvedValue({ sessionId: 'session-1', userId: 'user-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        {
          provide: RealtimeService,
          useValue: mockRealtimeService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        { provide: UserPermissionsService, useValue: mockPermissionsService },
        {
          provide: AuthRedisService,
          useValue: mockAuthRedisService,
        },
        {
          provide: RealtimePresenceService,
          useValue: mockPresenceService,
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
  });

  it('resolves room permissions from the database rather than the token', async () => {
    const client = createClient();
    client.handshake.auth = { token: 'access-token' } as never;
    mockJwtService.verifyAsync.mockResolvedValue(ACCESS_TOKEN_PAYLOAD);
    mockPermissionsService.getEffectivePermissions.mockResolvedValue(['permissions.read', 'permissions.manage']);

    await gateway.handleConnection(client);

    expect(mockPermissionsService.getEffectivePermissions).toHaveBeenCalledWith('user-1');
    expect(client.data.user.permissions).toEqual(['permissions.read', 'permissions.manage']);
  });

  it('rejects connections without a token', async () => {
    const client = createClient();

    await gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith(
      'realtime.error',
      expect.objectContaining({
        code: 'WS_AUTH_MISSING_TOKEN',
      }),
    );
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('forbids subscribing to protected rooms without permissions', () => {
    const client = createClient();
    client.data = {
      user: {
        id: 'user-1',
        permissions: ['users.read'],
      },
    };

    expect(() => gateway.handleSubscribe(client, { rooms: ['permissions'] } as never)).toThrow(
      expect.objectContaining({
        message: expect.stringContaining('Access to room "permissions" is forbidden.'),
      }),
    );
  });

  it('allows subscribing to the authenticated user room', () => {
    const client = createClient();
    client.data = {
      user: {
        id: 'user-1',
        permissions: [],
      },
    };

    const result = gateway.handleSubscribe(client, { rooms: ['user:user-1'] } as never);

    expect(result).toEqual({ rooms: ['user:user-1'] });
    expect(client.join).toHaveBeenCalledWith('user:user-1');
  });

  it('allows subscribing to the permissions room when the user has access', () => {
    const client = createClient();
    client.data = {
      user: {
        id: 'user-1',
        permissions: ['permissions.read'],
      },
    };

    const result = gateway.handleSubscribe(client, { rooms: ['permissions'] } as never);

    expect(result).toEqual({ rooms: ['permissions'] });
    expect(client.join).toHaveBeenCalledWith('room:permissions');
  });

  /**
   * A verified signature alone used to be enough to open a socket, so a session
   * that had been logged out kept receiving admin events for the rest of the
   * token's lifetime.
   */
  describe('session validation', () => {
    const connectWith = async (payload: Record<string, unknown>): Promise<Socket> => {
      const client = createClient();
      client.handshake.auth = { token: 'access-token' } as never;
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      await gateway.handleConnection(client);
      return client;
    };

    const expectRejection = (client: Socket, code: string): void => {
      expect(client.emit).toHaveBeenCalledWith('realtime.error', expect.objectContaining({ code }));
      expect(client.disconnect).toHaveBeenCalledWith(true);
    };

    it('binds the socket to the session room', async () => {
      const client = await connectWith(ACCESS_TOKEN_PAYLOAD);

      expect(client.join).toHaveBeenCalledWith('session:session-1');
      expect(client.data.sessionId).toBe('session-1');
    });

    it('marks the user online only once the socket is ready to receive events', async () => {
      const client = await connectWith(ACCESS_TOKEN_PAYLOAD);

      expect(mockPresenceService.connect).toHaveBeenCalledWith('user-1', client.id);
    });

    it('refreshes presence on heartbeat and clears it on disconnect', async () => {
      const client = await connectWith(ACCESS_TOKEN_PAYLOAD);

      gateway.handlePing(client);
      expect(mockPresenceService.touch).toHaveBeenCalledWith('user-1', client.id);

      gateway.handleDisconnect(client);
      expect(mockPresenceService.disconnect).toHaveBeenCalledWith('user-1', client.id);
    });

    it('leaves no presence record for a socket that never authenticated', () => {
      const client = createClient();

      gateway.handleDisconnect(client);

      expect(mockPresenceService.disconnect).not.toHaveBeenCalled();
    });

    it('refuses a token that is not a session access token', async () => {
      const client = await connectWith({ sub: 'user-1', sessionId: 'session-1' });

      expectRejection(client, 'WS_AUTH_INVALID_TOKEN');
      expect(mockAuthRedisService.getSession).not.toHaveBeenCalled();
    });

    it('refuses a token without a session', async () => {
      const client = await connectWith({ sub: 'user-1', tokenType: 'access' });

      expectRejection(client, 'WS_AUTH_INVALID_TOKEN');
    });

    it('refuses a session that no longer exists', async () => {
      mockAuthRedisService.getSession.mockResolvedValue(null);

      const client = await connectWith(ACCESS_TOKEN_PAYLOAD);

      expectRejection(client, 'WS_AUTH_SESSION_REVOKED');
    });

    it('refuses a session that belongs to somebody else', async () => {
      mockAuthRedisService.getSession.mockResolvedValue({ sessionId: 'session-1', userId: 'user-2' });

      const client = await connectWith(ACCESS_TOKEN_PAYLOAD);

      expectRejection(client, 'WS_AUTH_SESSION_REVOKED');
    });
  });

  /**
   * Regression for the bug that left every admin connected and deaf.
   *
   * `handleConnection` is async, so a `realtime.subscribe` frame that arrives
   * right after `connect` could reach the handlers before `client.data.user`
   * existed. `WsAuthGuard` then refused the subscription, the socket stayed in
   * no room at all, and the UI quietly stopped synchronising while still
   * reporting "connected". Authenticating in the Socket.IO middleware runs
   * before the connection is announced, which closes the window.
   */
  describe('handshake middleware', () => {
    const startServer = (): ((socket: Socket, next: (error?: Error) => void) => Promise<void>) => {
      let middleware: ((socket: Socket, next: (error?: Error) => void) => Promise<void>) | undefined;

      gateway.afterInit({
        use: (handler: typeof middleware) => {
          middleware = handler;
        },
      } as never);

      if (!middleware) {
        throw new Error('The gateway did not register any Socket.IO middleware.');
      }

      return middleware;
    };

    const handshakeWith = (rooms?: string[]): Socket => {
      const client = createClient();
      client.handshake.auth = { token: 'access-token', rooms } as never;
      mockJwtService.verifyAsync.mockResolvedValue(ACCESS_TOKEN_PAYLOAD);
      mockPermissionsService.getEffectivePermissions.mockResolvedValue(['users.read']);

      return client;
    };

    it('joins the rooms carried by the handshake before the socket is announced', async () => {
      const middleware = startServer();
      const client = handshakeWith(['users']);
      const next = jest.fn();

      await middleware(client, next);

      expect(next).toHaveBeenCalledWith();
      expect(client.join).toHaveBeenCalledWith('room:users');
      expect(client.data.authResolved).toBe(true);
    });

    it('fails the connection instead of leaving a socket with no user on it', async () => {
      const middleware = startServer();
      const client = handshakeWith();
      mockAuthRedisService.getSession.mockResolvedValue(null);
      const next = jest.fn();

      await middleware(client, next);

      const [error] = next.mock.calls[0];
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('WS_AUTH_SESSION_REVOKED');
      expect(client.join).not.toHaveBeenCalled();
    });

    it('never authenticates twice when the connection hook also runs', async () => {
      const middleware = startServer();
      const client = handshakeWith(['users']);

      await middleware(client, jest.fn());
      await gateway.handleConnection(client);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledTimes(1);
      expect(mockAuthRedisService.getSession).toHaveBeenCalledTimes(1);
    });
  });
});
