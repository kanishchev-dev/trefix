import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { setActivityContext } from '@/common/context/activity-context';
import { ADMIN_ENDPOINT_KEY } from '@/common/decorators/admin-endpoint.decorator';
import { LOG_DATA_ACCESS_KEY, type LogDataAccessOptions } from '@/common/decorators/log-data-access.decorator';
import {
  AUTH_CLIENT_APP_VERSION_HEADER,
  AUTH_CLIENT_DEVICE_HEADER,
  AUTH_CLIENT_HEADER_MAX_LENGTH,
  AUTH_CLIENT_PLATFORM_HEADER,
} from '@/modules/auth/auth.constants';
import type { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { ActivityService } from './activity.service';

const MOBILE_PLATFORMS: ReadonlySet<string> = new Set(['ios', 'android']);

function header(request: Request, name: string): string | undefined {
  const raw = request.headers[name];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value.slice(0, AUTH_CLIENT_HEADER_MAX_LENGTH) : undefined;
}

/**
 * Puts the actor of the request into the request context once authentication
 * has run, so domain events emitted while handling it are attributed to them.
 */
@Injectable()
export class ActivityContextInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activityService: ActivityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUserContext }>();
    const targets = [context.getHandler(), context.getClass()];
    const isAdminEndpoint = this.reflector.getAllAndOverride<boolean>(ADMIN_ENDPOINT_KEY, targets) === true;
    const platform = header(request, AUTH_CLIENT_PLATFORM_HEADER)?.toLowerCase();
    const actor = request.user;

    setActivityContext({
      actorUserId: actor?.id,
      actorType: actor ? (isAdminEndpoint ? 'admin' : 'user') : undefined,
      source: isAdminEndpoint ? 'admin' : platform && MOBILE_PLATFORMS.has(platform) ? 'mobile' : 'web',
      ip: request.ip,
      clientPlatform: platform,
      clientAppVersion: header(request, AUTH_CLIENT_APP_VERSION_HEADER),
      clientDevice: header(request, AUTH_CLIENT_DEVICE_HEADER),
    });

    const dataAccess = this.reflector.getAllAndOverride<LogDataAccessOptions | undefined>(LOG_DATA_ACCESS_KEY, targets);
    if (!dataAccess || !actor) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const params = request.params as Record<string, string | undefined>;
        void this.activityService.recordDataAccess({
          actorUserId: actor.id,
          subjectUserId: params[dataAccess.subjectParam ?? 'userId'] ?? null,
          resource: dataAccess.resource,
          resourceId: dataAccess.resourceParam ? (params[dataAccess.resourceParam] ?? null) : null,
        });
      }),
    );
  }
}
