import type { ActivityEventDescriptor } from './activity-event.registry';
import { buildActivityRecord } from './activity-record.builder';

const NOW = new Date('2026-10-16T09:00:00.000Z');

const workoutDescriptor: ActivityEventDescriptor<{ athleteId: string; workoutId: string }> = {
  domain: 'workouts',
  entityType: 'workout',
  subject: (payload) => ({ athleteId: payload.athleteId }),
  entityId: (payload) => payload.workoutId,
  changes: () => ({}),
};

const build = (
  context: Parameters<typeof buildActivityRecord>[3],
  descriptor: ActivityEventDescriptor<never> = workoutDescriptor as ActivityEventDescriptor<never>,
  payload: unknown = { athleteId: 'a-1', workoutId: 'w-1', userId: 'u-1' },
): ReturnType<typeof buildActivityRecord> =>
  buildActivityRecord(
    'training.workout.updated',
    payload,
    descriptor as ActivityEventDescriptor<unknown>,
    context,
    NOW,
  );

describe('buildActivityRecord', () => {
  it('attributes an admin-panel action to the administrator', () => {
    const record = build({ actorType: 'admin', actorUserId: 'admin-1', source: 'admin', traceId: 't-1' });

    expect(record).toMatchObject({
      actorType: 'admin',
      actorUserId: 'admin-1',
      source: 'admin',
      subject: { athleteId: 'a-1' },
      entityType: 'workout',
      entityId: 'w-1',
      traceId: 't-1',
      occurredAt: NOW.toISOString(),
    });
  });

  it('keeps the device the user acted from', () => {
    const record = build({
      actorType: 'user',
      actorUserId: 'u-1',
      source: 'mobile',
      clientPlatform: 'ios',
      clientAppVersion: '1.4.2',
      ip: '10.0.0.1',
    });

    expect(record.client).toEqual({ platform: 'ios', appVersion: '1.4.2', device: null });
    expect(record.ip).toBe('10.0.0.1');
  });

  it('treats an unauthenticated request as the person acting on their own account', () => {
    const descriptor = {
      domain: 'account',
      subject: (payload: { userId: string }): { userId: string } => ({ userId: payload.userId }),
    };

    const record = build({ source: 'mobile' }, descriptor as ActivityEventDescriptor<never>);

    expect(record.actorType).toBe('user');
    expect(record.actorUserId).toBe('u-1');
  });

  it('falls back to the system outside a request', () => {
    const record = build({});

    expect(record.actorType).toBe('system');
    expect(record.actorUserId).toBeNull();
    expect(record.source).toBe('job');
  });

  it('lets the descriptor override the actor and drops the person', () => {
    const descriptor = { ...workoutDescriptor, actorType: 'integration' as const };

    const record = build(
      { actorType: 'user', actorUserId: 'u-1', provider: 'strava' },
      descriptor as ActivityEventDescriptor<never>,
    );

    expect(record.actorType).toBe('integration');
    expect(record.actorUserId).toBeNull();
    expect(record.metadata).toEqual({ provider: 'strava' });
    expect(record.source).toBe('webhook');
  });

  it('stores no changes when nothing differs', () => {
    expect(build({ actorType: 'user', actorUserId: 'u-1' }).changes).toBeNull();
  });
});
