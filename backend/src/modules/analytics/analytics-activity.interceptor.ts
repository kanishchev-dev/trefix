import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';

import { ADMIN_ENDPOINT_KEY } from '@/common/decorators/admin-endpoint.decorator';
import {
  AUTH_CLIENT_APP_VERSION_HEADER,
  AUTH_CLIENT_HEADER_MAX_LENGTH,
  AUTH_CLIENT_PLATFORM_HEADER,
} from '@/modules/auth/auth.constants';
import type { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import type { AnalyticsPlatform } from './analytics.constants';
import { ActivityTrackingService } from './services/activity-tracking.service';

const APP_VERSION_MAX_LENGTH = 32;

function header(request: Request, name: string): string | undefined {
  const raw = request.headers[name];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value.slice(0, AUTH_CLIENT_HEADER_MAX_LENGTH) : undefined;
}

/**
 * Marks the authenticated user as active today. Runs after the guards, so
 * `request.user` is set; administrators working in the panel are not counted
 * as active users of the app.
 */
@Injectable()
export class AnalyticsActivityInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly trackingService: ActivityTrackingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUserContext }>();
    const userId = request.user?.id;
    const isAdminEndpoint =
      this.reflector.getAllAndOverride<boolean>(ADMIN_ENDPOINT_KEY, [context.getHandler(), context.getClass()]) ===
      true;
    if (userId && !isAdminEndpoint) {
      const raw = header(request, AUTH_CLIENT_PLATFORM_HEADER)?.toLowerCase();
      const platform: AnalyticsPlatform = raw === 'ios' || raw === 'android' ? raw : 'web';
      const appVersion = header(request, AUTH_CLIENT_APP_VERSION_HEADER)?.slice(0, APP_VERSION_MAX_LENGTH) ?? null;
      void this.trackingService.touch(userId, platform, appVersion);
    }
    return next.handle();
  }
}
