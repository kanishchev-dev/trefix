import { WsException } from '@nestjs/websockets';

import { RealtimeErrorPayload } from '../interfaces/realtime-event.interface';

export class RealtimeWsException extends WsException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    const payload: RealtimeErrorPayload = {
      code,
      message,
      details,
    };

    super(payload);
  }
}
