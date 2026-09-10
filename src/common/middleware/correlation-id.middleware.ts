import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';
import { uuidv7 } from 'uuidv7';

export const requestContext = new AsyncLocalStorage<Map<string, string>>();

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const traceId = (req.headers['x-request-id'] as string) || uuidv7();
    req.headers['x-request-id'] = traceId;
    res.set('X-Request-Id', traceId);

    const store = new Map<string, string>();
    store.set('traceId', traceId);

    requestContext.run(store, () => next());
  }
}
