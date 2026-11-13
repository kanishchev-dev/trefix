import type { ActivityContext, ActivitySourceChannel, ActorType } from '@/common/context/activity-context';
import type { FieldChanges } from '@/common/utils/field-changes.util';

import type { ActivityDomain } from './activity.constants';
import type { ActivityEventDescriptor, ActivitySubjectRef } from './activity-event.registry';
import type { ActivityClientInfo } from './entities/activity-event.entity';

/** Payload of an `activity-write` job: everything known when the domain event fired. */
export interface ActivityWriteJobData {
  occurredAt: string;
  action: string;
  domain: ActivityDomain;
  subject: ActivitySubjectRef;
  actorType: ActorType;
  actorUserId: string | null;
  entityType: string | null;
  entityId: string | null;
  changes: FieldChanges | null;
  metadata: Record<string, unknown>;
  source: ActivitySourceChannel;
  client: ActivityClientInfo | null;
  ip: string | null;
  traceId: string | null;
}

const PERSON_ACTORS: ReadonlySet<ActorType> = new Set(['user', 'admin']);

function resolveActor(
  descriptor: ActivityEventDescriptor<unknown>,
  context: ActivityContext,
  subject: ActivitySubjectRef,
): { actorType: ActorType; actorUserId: string | null } {
  if (descriptor.actorType) {
    return { actorType: descriptor.actorType, actorUserId: null };
  }
  if (context.actorType) {
    const actorUserId = PERSON_ACTORS.has(context.actorType) ? (context.actorUserId ?? null) : null;
    return { actorType: context.actorType, actorUserId };
  }
  if (context.source) {
    // Unauthenticated request (sign-up, sign-in, password reset): the person acts on their own account.
    return { actorType: 'user', actorUserId: subject && 'userId' in subject ? subject.userId : null };
  }
  return { actorType: 'system', actorUserId: null };
}

function resolveClient(context: ActivityContext): ActivityClientInfo | null {
  if (!context.clientPlatform && !context.clientAppVersion && !context.clientDevice) {
    return null;
  }
  return {
    platform: context.clientPlatform ?? null,
    appVersion: context.clientAppVersion ?? null,
    device: context.clientDevice ?? null,
  };
}

/**
 * Turns a domain event into a history entry. Pure: the actor comes from the
 * context captured at emit time, so the result is the same whenever the job
 * is processed.
 */
export function buildActivityRecord(
  action: string,
  payload: unknown,
  descriptor: ActivityEventDescriptor<unknown>,
  context: ActivityContext,
  now: Date,
): ActivityWriteJobData {
  const subject = descriptor.subject(payload);
  const { actorType, actorUserId } = resolveActor(descriptor, context, subject);
  const changes = descriptor.changes?.(payload) ?? null;
  const metadata = { ...(descriptor.metadata?.(payload) ?? {}) };
  if (actorType === 'integration' && context.provider && metadata['provider'] === undefined) {
    metadata['provider'] = context.provider;
  }

  return {
    occurredAt: now.toISOString(),
    action,
    domain: descriptor.domain,
    subject,
    actorType,
    actorUserId,
    entityType: descriptor.entityType ?? null,
    entityId: descriptor.entityId?.(payload) ?? null,
    changes: changes && Object.keys(changes).length > 0 ? changes : null,
    metadata,
    source: context.source ?? (actorType === 'integration' ? 'webhook' : 'job'),
    client: resolveClient(context),
    ip: context.ip ?? null,
    traceId: context.traceId ?? null,
  };
}
