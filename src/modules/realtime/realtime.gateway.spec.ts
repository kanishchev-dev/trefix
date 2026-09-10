import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

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
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

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
    mockConfigService.get.mockImplementation((key: string) => (key === 'JWT_SECRET' ? 'secret' : undefined));

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
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
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
});
