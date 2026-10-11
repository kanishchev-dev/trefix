import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { AuthRedisService } from '@/modules/auth/services/auth-redis.service';
import { PermissionsService } from '@/modules/permissions/permissions.service';

import {
  REALTIME_INBOUND_AUTH_EVENT,
  REALTIME_INBOUND_COMMAND_EVENT,
  REALTIME_INBOUND_PING_EVENT,
  REALTIME_INBOUND_SUBSCRIBE_EVENT,
  REALTIME_INBOUND_UNSUBSCRIBE_EVENT,
  REALTIME_NAMESPACE,
  REALTIME_OUTBOUND_AUTHENTICATED_EVENT,
  REALTIME_OUTBOUND_ERROR_EVENT,
} from './constants/realtime.constants';
import { REALTIME_ROOM_PERMISSION_MAP } from './constants/realtime-permissions.constants';
import { RealtimeAuthDto, RealtimeCommandDto, RealtimeSubscriptionDto } from './dto';
import { RealtimeWsException } from './exceptions/realtime-ws.exception';
import { WsAuthGuard } from './guards/ws-auth.guard';
import {
  RealtimeAuthPayload,
  RealtimeAuthResult,
  RealtimeErrorPayload,
  RealtimeSocketData,
  RealtimeUserContext,
} from './interfaces/realtime-event.interface';
import { RealtimeService } from './realtime.service';
import { RealtimePresenceService } from './services/realtime-presence.service';

interface JwtSocketPayload {
  sub?: string;
  userId?: string;
  uid?: string;
  email?: string;
  tokenType?: string;
  sessionId?: string;
  [key: string]: unknown;
}

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly permissionsService: PermissionsService,
    private readonly authRedisService: AuthRedisService,
    private readonly presenceService: RealtimePresenceService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.attachServer(server);
    this.registerHandshakeAuth(server);
    this.logger.log(`Realtime gateway initialized on namespace ${REALTIME_NAMESPACE}`);
  }

  /**
   * Authenticates in the Socket.IO middleware, before the connection is
   * announced to the gateway.
   *
   * `handleConnection` is async — it verifies the JWT, reads the session from
   * Redis and resolves the user's permissions from the database. A client that
   * subscribes the instant it connects therefore races it: the `realtime.subscribe`
   * frame is handled while `client.data.user` is still empty, `WsAuthGuard`
   * rejects it, and the socket stays open forever without a single room. The
   * indicator keeps reporting "connected" while nothing is ever delivered, and
   * the UI silently stops synchronising.
   *
   * Middleware runs before the `connection` event, so authenticating here makes
   * the guard see a fully initialised socket. Rooms can also ride along in the
   * handshake (`auth.rooms`), which joins them as part of this same step instead
   * of relying on a second round trip.
   */
  private registerHandshakeAuth(server: Server): void {
    server.use(async (socket: Socket, next: (error?: Error) => void) => {
      try {
        const result = await this.authenticate(
          socket,
          socket.handshake.auth as Partial<RealtimeAuthPayload> | undefined,
        );
        this.applyAuth(socket, result);
        next();
      } catch (error) {
        const payload = this.toErrorPayload(error);
        // Surfaced as a `connect_error` on the client, so a rejected socket can
        // no longer masquerade as a healthy connection.
        next(new Error(`${payload.code}: ${payload.message}`));
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const socketData = client.data as RealtimeSocketData;

    if (socketData.authResolved) {
      this.logger.log(
        `Client connected: ${client.id} (${socketData.user?.id}) rooms=[${(socketData.rooms || []).join(', ')}]`,
      );
      return;
    }

    // Fallback for hosts that never run `afterInit` (tests, alternative
    // adapters): the middleware above is the normal path.
    try {
      const result = await this.authenticate(client, client.handshake.auth as Partial<RealtimeAuthPayload> | undefined);
      this.applyAuth(client, result);
      this.logger.log(`Client connected: ${client.id} (${result.user.id})`);
    } catch (error) {
      this.rejectConnection(client, this.toErrorPayload(error));
    }
  }

  handleDisconnect(client: Socket): void {
    const socketData = client.data as RealtimeSocketData;
    this.logger.log(`Client disconnected: ${client.id}${socketData.user?.id ? ` (${socketData.user.id})` : ''}`);

    if (socketData.user?.id) {
      void this.presenceService.disconnect(socketData.user.id, client.id);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(REALTIME_INBOUND_AUTH_EVENT)
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RealtimeAuthDto,
  ): Promise<RealtimeAuthResult> {
    const result = await this.authenticate(client, payload);
    this.applyAuth(client, result);
    return result;
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(REALTIME_INBOUND_SUBSCRIBE_EVENT)
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RealtimeSubscriptionDto,
  ): { rooms: string[] } {
    const joinedRooms = this.joinRooms(client, payload.rooms);

    this.logger.log(
      `Client ${client.id} (${(client.data as RealtimeSocketData).user?.id}) subscribed to [${joinedRooms.join(', ')}]`,
    );

    return { rooms: joinedRooms };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(REALTIME_INBOUND_UNSUBSCRIBE_EVENT)
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RealtimeSubscriptionDto,
  ): { rooms: string[] } {
    const leftRooms = this.leaveRooms(client, payload.rooms);
    return { rooms: leftRooms };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(REALTIME_INBOUND_COMMAND_EVENT)
  handleCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RealtimeCommandDto,
  ): { accepted: boolean; event: string } {
    this.logger.debug(`Realtime command received: ${payload.event} from ${client.id}`);
    return { accepted: true, event: payload.event };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(REALTIME_INBOUND_PING_EVENT)
  handlePing(@ConnectedSocket() client: Socket): { pong: true; timestamp: string } {
    const socketData = client.data as RealtimeSocketData;

    if (socketData.user?.id) {
      void this.presenceService.touch(socketData.user.id, client.id);
    }

    return {
      pong: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async authenticate(client: Socket, payload?: Partial<RealtimeAuthPayload>): Promise<RealtimeAuthResult> {
    const token = this.extractToken(client, payload);

    if (!token) {
      throw new RealtimeWsException('WS_AUTH_MISSING_TOKEN', 'WebSocket token is required.');
    }

    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new RealtimeWsException('WS_AUTH_MISCONFIGURED', 'JWT access secret is not configured.');
    }

    const decoded = await this.jwtService.verifyAsync<JwtSocketPayload>(token, { secret });
    const userId = this.extractUserId(decoded);

    if (!userId) {
      throw new RealtimeWsException('WS_AUTH_INVALID_TOKEN', 'JWT payload does not contain a user identifier.');
    }

    // Same contract the REST guard enforces. Verifying the signature alone would
    // let a revoked session, or a token minted for another purpose, keep a live
    // feed of admin events for the rest of its lifetime.
    if (decoded.tokenType !== 'access' || !decoded.sessionId) {
      throw new RealtimeWsException('WS_AUTH_INVALID_TOKEN', 'Only a session access token may open a WebSocket.');
    }

    const session = await this.authRedisService.getSession(decoded.sessionId);
    if (!session || session.userId !== userId) {
      throw new RealtimeWsException(
        'WS_AUTH_SESSION_REVOKED',
        'The session this token belongs to is no longer active.',
      );
    }

    const user: RealtimeUserContext = {
      id: userId,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
      permissions: await this.resolvePermissions(userId),
    };

    const rooms = this.normalizeRooms(payload?.rooms ?? []);
    return { user, rooms, sessionId: decoded.sessionId };
  }

  /**
   * Resolves the effective permissions of a socket user.
   *
   * The access token intentionally carries no permission claims, so the
   * gateway resolves them per connection. That keeps room access in sync
   * with the current group/permission assignments instead of the token
   * issue time.
   */
  private async resolvePermissions(userId: string): Promise<string[]> {
    try {
      return await this.permissionsService.getEffectivePermissions(userId);
    } catch (error) {
      this.logger.warn(`Failed to resolve realtime permissions for user ${userId}: ${(error as Error).message}`);
      return [];
    }
  }

  private applyAuth(client: Socket, result: RealtimeAuthResult): void {
    const socketData = client.data as RealtimeSocketData;
    socketData.user = result.user;
    socketData.rooms = result.rooms;
    socketData.sessionId = result.sessionId;
    socketData.authResolved = true;

    client.join(this.realtimeService.getUserRoom(result.user.id));
    // Bound to the session room so a logout can drop this socket at once.
    client.join(this.realtimeService.getSessionRoom(result.sessionId));
    this.joinRooms(client, result.rooms);
    client.emit(REALTIME_OUTBOUND_AUTHENTICATED_EVENT, result);

    // Registered here, and not when rooms are joined, so a user only shows up
    // as online once they are actually able to receive events.
    void this.presenceService.connect(result.user.id, client.id);
  }

  private joinRooms(client: Socket, rooms: readonly string[]): string[] {
    const normalizedRooms = this.normalizeRooms(rooms);
    this.assertRoomAccess(client, normalizedRooms);
    normalizedRooms.forEach((room) => client.join(this.resolveSocketRoom(room)));
    const socketData = client.data as RealtimeSocketData;
    socketData.rooms = [...new Set([...(socketData.rooms || []), ...normalizedRooms])];
    return normalizedRooms;
  }

  private leaveRooms(client: Socket, rooms: readonly string[]): string[] {
    const normalizedRooms = this.normalizeRooms(rooms);
    normalizedRooms.forEach((room) => client.leave(this.resolveSocketRoom(room)));
    const socketData = client.data as RealtimeSocketData;
    socketData.rooms = (socketData.rooms || []).filter((room) => !normalizedRooms.includes(room));
    return normalizedRooms;
  }

  private normalizeRooms(rooms: readonly string[]): string[] {
    return [...new Set(rooms.map((room) => room.trim()).filter((room) => room.length > 0))];
  }

  private extractUserId(payload: JwtSocketPayload): string | null {
    const candidates = [payload.sub, payload.userId, payload.uid];
    const match = candidates.find((value) => typeof value === 'string' && value.length > 0);
    return match ?? null;
  }

  private extractToken(client: Socket, payload?: Partial<RealtimeAuthPayload>): string | undefined {
    const authToken = payload?.token ?? (client.handshake.auth as Partial<RealtimeAuthPayload> | undefined)?.token;
    if (authToken) {
      return authToken;
    }

    const authorizationHeader = client.handshake.headers.authorization;
    if (!authorizationHeader) {
      return undefined;
    }

    const [scheme, value] = authorizationHeader.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? value : undefined;
  }

  private assertRoomAccess(client: Socket, rooms: readonly string[]): void {
    const socketData = client.data as RealtimeSocketData;
    const userId = socketData.user?.id;
    const permissions = socketData.user?.permissions || [];

    rooms.forEach((room) => {
      const normalizedRoom = this.normalizeRoomKey(room);

      if (userId && normalizedRoom === this.realtimeService.getUserRoom(userId)) {
        return;
      }

      const requiredPermissions = REALTIME_ROOM_PERMISSION_MAP[normalizedRoom];
      if (requiredPermissions && requiredPermissions.some((permission) => permissions.includes(permission))) {
        return;
      }

      throw new RealtimeWsException('WS_ROOM_FORBIDDEN', `Access to room "${room}" is forbidden.`, { room });
    });
  }

  private resolveSocketRoom(room: string): string {
    const normalizedRoom = this.normalizeRoomKey(room);

    if (normalizedRoom.startsWith('user:')) {
      return normalizedRoom;
    }

    return this.realtimeService.getRoom(normalizedRoom);
  }

  private normalizeRoomKey(room: string): string {
    return room.startsWith('room:') ? room.slice('room:'.length) : room;
  }

  private rejectConnection(client: Socket, error: RealtimeErrorPayload): void {
    client.emit(REALTIME_OUTBOUND_ERROR_EVENT, error);
    client.disconnect(true);
    this.logger.warn(`Realtime connection rejected: ${client.id} (${error.code})`);
  }

  private toErrorPayload(error: unknown): RealtimeErrorPayload {
    if (error instanceof RealtimeWsException) {
      return error.getError() as RealtimeErrorPayload;
    }

    if (typeof error === 'object' && error !== null && 'error' in error) {
      const payload = (error as { error?: unknown }).error;
      if (typeof payload === 'object' && payload !== null && 'code' in payload && 'message' in payload) {
        return payload as RealtimeErrorPayload;
      }
    }

    if (error instanceof Error) {
      return {
        code: 'WS_AUTH_FAILED',
        message: error.message,
      };
    }

    return {
      code: 'WS_AUTH_FAILED',
      message: 'WebSocket authentication failed.',
    };
  }
}
