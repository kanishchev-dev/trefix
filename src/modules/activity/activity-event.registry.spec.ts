import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { COACH_EVENTS } from '@/modules/coach/coach.events';
import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { NOTIFICATIONS_EVENTS } from '@/modules/notifications/notifications.events';
import { PERMISSIONS_EVENTS } from '@/modules/permissions/permissions.events';
import { SETTINGS_EVENTS } from '@/modules/settings/settings.events';
import { STORAGE_EVENT_FILE_DELETED, STORAGE_EVENT_FILE_UPLOADED } from '@/modules/storage/storage.constants';
import { TRAINING_EVENTS } from '@/modules/training/training.events';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { ACTIVITY_DOMAINS } from './activity.constants';
import { ACTIVITY_EVENT_REGISTRY, ACTIVITY_IGNORED_EVENTS } from './activity-event.registry';
import { ACTIVITY_EVENTS } from './events/activity.events';

const ALL_DOMAIN_EVENTS: string[] = [
  ...Object.values(AUTH_EVENTS),
  ...Object.values(COACH_EVENTS),
  ...Object.values(INTEGRATIONS_EVENTS),
  ...Object.values(NOTIFICATIONS_EVENTS),
  ...Object.values(PERMISSIONS_EVENTS),
  ...Object.values(SETTINGS_EVENTS),
  ...Object.values(TRAINING_EVENTS),
  ...Object.values(USERS_EVENTS),
  ...Object.values(ACTIVITY_EVENTS),
  STORAGE_EVENT_FILE_UPLOADED,
  STORAGE_EVENT_FILE_DELETED,
];

describe('ACTIVITY_EVENT_REGISTRY', () => {
  it('describes or explicitly ignores every domain event', () => {
    const undecided = ALL_DOMAIN_EVENTS.filter(
      (event) => !ACTIVITY_EVENT_REGISTRY[event] && !ACTIVITY_IGNORED_EVENTS.has(event),
    );

    expect(undecided).toEqual([]);
  });

  it('never both describes and ignores an event', () => {
    expect(Object.keys(ACTIVITY_EVENT_REGISTRY).filter((event) => ACTIVITY_IGNORED_EVENTS.has(event))).toEqual([]);
  });

  it('only describes events that exist', () => {
    const known = new Set(ALL_DOMAIN_EVENTS);

    expect(Object.keys(ACTIVITY_EVENT_REGISTRY).filter((event) => !known.has(event))).toEqual([]);
  });

  it('assigns every event to a known section', () => {
    const domains = new Set<string>(ACTIVITY_DOMAINS);

    expect(
      Object.entries(ACTIVITY_EVENT_REGISTRY)
        .filter(([, descriptor]) => !domains.has(descriptor.domain))
        .map(([event]) => event),
    ).toEqual([]);
  });

  it('resolves training events to the athlete and account events to the user', () => {
    const workout = ACTIVITY_EVENT_REGISTRY[TRAINING_EVENTS.WORKOUT_UPDATED];
    const payload = { athleteId: 'a-1', workoutId: 'w-1', planId: null, changedFields: ['distanceKm'], changes: null };

    expect(workout.subject(payload as never)).toEqual({ athleteId: 'a-1' });
    expect(workout.entityId?.(payload as never)).toBe('w-1');
    expect(ACTIVITY_EVENT_REGISTRY[AUTH_EVENTS.SESSION_CREATED].subject({ userId: 'u-1' } as never)).toEqual({
      userId: 'u-1',
    });
  });

  it('attributes imports to the integration whoever triggered them', () => {
    expect(ACTIVITY_EVENT_REGISTRY[INTEGRATIONS_EVENTS.ACTIVITY_IMPORTED].actorType).toBe('integration');
    expect(ACTIVITY_EVENT_REGISTRY[COACH_EVENTS.WORKOUT_NOTE_GENERATED].actorType).toBe('coach');
  });
});
