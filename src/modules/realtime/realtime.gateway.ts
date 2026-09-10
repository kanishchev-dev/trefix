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

interface JwtSocketPayload {
  sub?: string;
  userId?: string;
  uid?: string;
  email?: string;
  permissions?: string[];
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
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.attachServer(server);
    this.logger.log(`Realtime gateway initialized on namespace ${REALTIME_NAMESPACE}`);
  }

  async handleConnection(client: Socket): Promise<void> {
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
  handlePing(): { pong: true; timestamp: string } {
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

    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new RealtimeWsException('WS_AUTH_MISCONFIGURED', 'JWT secret is not configured.');
    }

    const decoded = await this.jwtService.verifyAsync<JwtSocketPayload>(token, { secret });
    const userId = this.extractUserId(decoded);

    if (!userId) {
      throw new RealtimeWsException('WS_AUTH_INVALID_TOKEN', 'JWT payload does not contain a user identifier.');
    }

    const user: RealtimeUserContext = {
      id: userId,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
      permissions: Array.isArray(decoded.permissions)
        ? decoded.permissions.filter((permission: unknown): permission is string => typeof permission === 'string')
        : undefined,
    };

    const rooms = this.normalizeRooms(payload?.rooms ?? []);
    return { user, rooms };
  }

  private applyAuth(client: Socket, result: RealtimeAuthResult): void {
    const socketData = client.data as RealtimeSocketData;
    socketData.user = result.user;
    socketData.rooms = result.rooms;

    client.join(this.realtimeService.getUserRoom(result.user.id));
    this.joinRooms(client, result.rooms);
    client.emit(REALTIME_OUTBOUND_AUTHENTICATED_EVENT, result);
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
