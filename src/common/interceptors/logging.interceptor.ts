import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { requestContext } from '../middleware/correlation-id.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const now = Date.now();
    const traceId = requestContext.getStore()?.get('traceId') || 'no-trace-id';

    this.maskSensitiveData(body);

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;
        this.logger.log(`[${traceId}] ${method} ${url} ${response.statusCode as number} - ${delay}ms`);
      }),
    );
  }

  private maskSensitiveData(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    const masked = { ...(data as Record<string, unknown>) };
    const sensitiveKeys = ['password', 'token', 'secret', 'creditCard'];
    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        masked[key] = '********';
      }
    }
    return masked;
  }
}
