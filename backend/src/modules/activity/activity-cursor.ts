import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';

import { ACTIVITY_ERROR_CODES } from './activity.constants';

export interface ActivityCursor {
  occurredAt: Date;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opaque keyset cursor: entries are ordered by (occurred_at, id) descending. */
export function encodeActivityCursor(cursor: ActivityCursor): string {
  return Buffer.from(`${cursor.occurredAt.toISOString()}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeActivityCursor(value: string): ActivityCursor {
  const [at, id] = Buffer.from(value, 'base64url').toString('utf8').split('|');
  const occurredAt = new Date(at ?? '');
  if (!id || !UUID.test(id) || Number.isNaN(occurredAt.getTime())) {
    throw new DomainBadRequestException(ACTIVITY_ERROR_CODES.cursorInvalid, 'Activity cursor is invalid');
  }
  return { occurredAt, id };
}
