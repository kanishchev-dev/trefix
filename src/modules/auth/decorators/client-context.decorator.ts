import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import {
  AUTH_CLIENT_APP_VERSION_HEADER,
  AUTH_CLIENT_DEVICE_HEADER,
  AUTH_CLIENT_HEADER_MAX_LENGTH,
  AUTH_CLIENT_PLATFORM_HEADER,
} from '../auth.constants';
import type { AuthClientContext } from '../interfaces/auth-client-context.interface';

function header(request: Request, name: string): string | undefined {
  const raw = request.headers[name];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value.slice(0, AUTH_CLIENT_HEADER_MAX_LENGTH) : undefined;
}

/** Client details for a new session: user agent, IP and what the app reports about the device. */
export const ClientContext = createParamDecorator((_: unknown, context: ExecutionContext): AuthClientContext => {
  const request = context.switchToHttp().getRequest<Request>();
  return {
    userAgent: header(request, 'user-agent'),
    ipAddress: request.ip,
    deviceName: header(request, AUTH_CLIENT_DEVICE_HEADER),
    platform: header(request, AUTH_CLIENT_PLATFORM_HEADER)?.toLowerCase(),
    appVersion: header(request, AUTH_CLIENT_APP_VERSION_HEADER),
  };
});
