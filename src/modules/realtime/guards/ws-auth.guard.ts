import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { REALTIME_OUTBOUND_ERROR_EVENT } from '../constants/realtime.constants';
import { RealtimeErrorPayload, RealtimeSocketData } from '../interfaces/realtime-event.interface';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const socketData = client.data as RealtimeSocketData;

    if (socketData.user?.id) {
      return true;
    }

    const error: RealtimeErrorPayload = {
      code: 'WS_NOT_AUTHENTICATED',
      message: 'WebSocket connection is not authenticated.',
    };

    client.emit(REALTIME_OUTBOUND_ERROR_EVENT, error);
    throw new WsException(error);
  }
}
