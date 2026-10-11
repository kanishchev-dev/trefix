import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';
import { uuidv7 } from 'uuidv7';

export const REQUEST_ID_HEADER = 'x-request-id';
export const NO_TRACE_ID = 'no-trace-id';

/** Accepts ids from upstream proxies, but only in a shape that is safe to log. */
const INCOMING_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestContext = new AsyncLocalStorage<Map<string, string>>();

/** Trace id of the current request, or a placeholder outside a request (jobs, startup). */
export function getTraceId(): string {
  return requestContext.getStore()?.get('traceId') ?? NO_TRACE_ID;
}

/** Reuses a well-formed incoming `X-Request-Id` or issues a new one. */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  return candidate && INCOMING_REQUEST_ID_PATTERN.test(candidate) ? candidate : uuidv7();
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // pino-http runs earlier and has already assigned `req.id`; keep both in step.
    const traceId = typeof req.id === 'string' ? req.id : resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    req.headers[REQUEST_ID_HEADER] = traceId;
    res.set('X-Request-Id', traceId);

    const store = new Map<string, string>();
    store.set('traceId', traceId);

    requestContext.run(store, () => next());
  }
}
