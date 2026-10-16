import { uuidv7 } from 'uuidv7';

import { requestContext } from '../middleware/correlation-id.middleware';

/** Who performed an action recorded in the activity history. */
export const ACTOR_TYPES = ['user', 'admin', 'system', 'integration', 'coach'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Channel an action came through. */
export const ACTIVITY_SOURCES = ['mobile', 'web', 'admin', 'webhook', 'job'] as const;
export type ActivitySourceChannel = (typeof ACTIVITY_SOURCES)[number];

/**
 * Actor of the code currently running, shared by everything executed within
 * one request or one background job. Domain events do not carry the actor, so
 * the activity history reads it from here at the moment an event is emitted.
 */
export interface ActivityContext {
  traceId?: string;
  actorType?: ActorType;
  actorUserId?: string;
  source?: ActivitySourceChannel;
  ip?: string;
  clientPlatform?: string;
  clientAppVersion?: string;
  clientDevice?: string;
  /** Integration provider when `actorType` is `integration`. */
  provider?: string;
}

const CONTEXT_KEYS: readonly (keyof ActivityContext)[] = [
  'traceId',
  'actorType',
  'actorUserId',
  'source',
  'ip',
  'clientPlatform',
  'clientAppVersion',
  'clientDevice',
  'provider',
];

/** Snapshot of the current context; empty outside a request or a wrapped job. */
export function getActivityContext(): ActivityContext {
  const store = requestContext.getStore();
  if (!store) {
    return {};
  }
  const context: Record<string, string> = {};
  for (const key of CONTEXT_KEYS) {
    const value = store.get(key);
    if (value !== undefined) {
      context[key] = value;
    }
  }
  return context as ActivityContext;
}

/** Fills fields of the current request context; a no-op outside one. */
export function setActivityContext(partial: ActivityContext): void {
  const store = requestContext.getStore();
  if (!store) {
    return;
  }
  for (const key of CONTEXT_KEYS) {
    const value = partial[key];
    if (value !== undefined) {
      store.set(key, value);
    }
  }
}

/**
 * Runs `fn` with an actor that differs from the caller's, e.g. an integration
 * importing data during a user's request or a background job. The trace id of
 * the surrounding request is kept so the history stays traceable.
 */
export function runWithActivityContext<T>(context: ActivityContext, fn: () => T): T {
  const parent = requestContext.getStore();
  const store = new Map<string, string>();
  store.set('traceId', parent?.get('traceId') ?? uuidv7());
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (value !== undefined) {
      store.set(key, value);
    }
  }
  return requestContext.run(store, fn);
}
