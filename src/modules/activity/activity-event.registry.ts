import type { ActorType } from '@/common/context/activity-context';
import type { FieldChanges } from '@/common/utils/field-changes.util';
import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import type { AuthEmailChangedEvent } from '@/modules/auth/events/auth-email-changed.event';
import type { AuthIdentityChangedEvent } from '@/modules/auth/events/auth-identity-changed.event';
import type { AuthSessionCreatedEvent } from '@/modules/auth/events/auth-session-created.event';
import type { AuthSessionRevokedEvent } from '@/modules/auth/events/auth-session-revoked.event';
import { COACH_EVENTS } from '@/modules/coach/coach.events';
import type { CoachSessionCreatedEvent } from '@/modules/coach/events/coach-session-created.event';
import type { CoachWorkoutNoteGeneratedEvent } from '@/modules/coach/events/coach-workout-note-generated.event';
import type { DeviceSyncCompletedEvent } from '@/modules/integrations/device/device-sync.events';
import type { ActivityImportedEvent } from '@/modules/integrations/events/activity-imported.event';
import type { ActivitySourceChangedEvent } from '@/modules/integrations/events/activity-source-changed.event';
import type { IntegrationConnectedEvent } from '@/modules/integrations/events/integration-connected.event';
import type { WorkoutSourceUnlinkedEvent } from '@/modules/integrations/events/workout-source-unlinked.event';
import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import type { BroadcastCreatedEvent, PushDeviceEvent } from '@/modules/notifications/events/notification.events';
import { NOTIFICATIONS_EVENTS } from '@/modules/notifications/notifications.events';
import type { PermissionCreatedEvent } from '@/modules/permissions/events/permission-created.event';
import type { PermissionGroupUpdatedEvent } from '@/modules/permissions/events/permission-group-updated.event';
import type { UserPermissionsUpdatedEvent } from '@/modules/permissions/events/user-permissions-updated.event';
import { PERMISSIONS_EVENTS } from '@/modules/permissions/permissions.events';
import { SETTINGS_EVENTS } from '@/modules/settings/settings.events';
import { STORAGE_EVENT_FILE_DELETED, STORAGE_EVENT_FILE_UPLOADED } from '@/modules/storage/storage.constants';
import type { GearReplaceSoonEvent, GearUpdatedEvent } from '@/modules/training/events/gear.events';
import type { GoalCreatedEvent } from '@/modules/training/events/goal-created.event';
import type {
  PlanAdaptationDismissedEvent,
  PlanAdaptationProposedEvent,
  PlanAdaptedEvent,
} from '@/modules/training/events/plan-adapted.event';
import type { PlanCancelledEvent } from '@/modules/training/events/plan-cancelled.event';
import type { PlanCreatedEvent } from '@/modules/training/events/plan-created.event';
import type { PlanStartedEvent } from '@/modules/training/events/plan-started.event';
import type { PlanUpdatedEvent } from '@/modules/training/events/plan-updated.event';
import type { WorkoutUpdatedEvent } from '@/modules/training/events/workout-updated.event';
import { TRAINING_EVENTS } from '@/modules/training/training.events';
import type { ConsentGivenEvent, ConsentRevokedEvent } from '@/modules/users/consents/events/consent.events';
import type { DataExportRequestedEvent } from '@/modules/users/data-export/data-export.events';
import type { UserBlockedEvent } from '@/modules/users/events/user-blocked.event';
import type { PreferencesUpdatedEvent } from '@/modules/users/preferences/events/preferences-updated.event';
import { USERS_EVENTS } from '@/modules/users/users.events';

import type { ActivityDomain } from './activity.constants';
import { ACTIVITY_EVENTS, type DataAccessedEvent } from './events/activity.events';

/** Whose history an event belongs to; training events only know the athlete. */
export type ActivitySubjectRef = { userId: string } | { athleteId: string } | null;

export interface ActivityEventDescriptor<P = unknown> {
  domain: ActivityDomain;
  entityType?: string;
  /** Overrides the actor of the surrounding context for events that are never made by a person. */
  actorType?: ActorType;
  subject(payload: P): ActivitySubjectRef;
  entityId?(payload: P): string | null;
  changes?(payload: P): FieldChanges | null | undefined;
  metadata?(payload: P): Record<string, unknown>;
}

type AnyDescriptor = ActivityEventDescriptor<never>;

function describe<P>(descriptor: ActivityEventDescriptor<P>): AnyDescriptor {
  return descriptor as AnyDescriptor;
}

interface UserPayload {
  userId: string;
}
interface AthletePayload {
  athleteId: string;
}
interface PlanPayload extends AthletePayload {
  planId: string;
}
interface WorkoutPayload extends AthletePayload {
  workoutId: string;
  planId?: string | null;
}

const byUser = (payload: UserPayload): ActivitySubjectRef => ({ userId: payload.userId });
const byAthlete = (payload: AthletePayload): ActivitySubjectRef => ({ athleteId: payload.athleteId });

const planEvent = (metadata?: (payload: never) => Record<string, unknown>): AnyDescriptor =>
  describe<PlanPayload>({
    domain: 'plans',
    entityType: 'plan',
    subject: byAthlete,
    entityId: (payload) => payload.planId,
    metadata: metadata as ((payload: PlanPayload) => Record<string, unknown>) | undefined,
  });

const workoutEvent = (extra: Partial<ActivityEventDescriptor<WorkoutPayload>> = {}): AnyDescriptor =>
  describe<WorkoutPayload>({
    domain: 'workouts',
    entityType: 'workout',
    subject: byAthlete,
    entityId: (payload) => payload.workoutId,
    metadata: (payload) => (payload.planId ? { planId: payload.planId } : {}),
    ...extra,
  });

const importEvent = describe<ActivityImportedEvent | ActivitySourceChangedEvent>({
  domain: 'integrations',
  entityType: 'workout',
  actorType: 'integration',
  subject: byAthlete,
  entityId: (payload) => payload.workoutId,
  metadata: (payload) => ({ provider: payload.sourceProvider, sourceActivityId: payload.sourceActivityId }),
});

const permissionCatalogEvent = describe<PermissionCreatedEvent>({
  domain: 'access',
  entityType: 'permission',
  subject: () => null,
  entityId: (payload) => payload.id,
  metadata: (payload) => ({ name: payload.name }),
});

const permissionGroupEvent = describe<PermissionCreatedEvent>({
  domain: 'access',
  entityType: 'permission_group',
  subject: () => null,
  entityId: (payload) => payload.id,
  metadata: (payload) => ({ name: payload.name }),
});

/**
 * Every domain event that becomes an entry of the activity history, keyed by
 * event name. Events that must not be recorded are listed in
 * `ACTIVITY_IGNORED_EVENTS`; an event in neither list fails the registry test.
 */
export const ACTIVITY_EVENT_REGISTRY: Readonly<Record<string, AnyDescriptor>> = {
  // ------------------------------------------------------------------ account
  [AUTH_EVENTS.REGISTERED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [AUTH_EVENTS.EMAIL_VERIFIED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [AUTH_EVENTS.EMAIL_CHANGE_REQUESTED]: describe<UserPayload>({
    domain: 'account',
    entityType: 'user',
    subject: byUser,
  }),
  [AUTH_EVENTS.EMAIL_CHANGED]: describe<AuthEmailChangedEvent>({
    domain: 'account',
    entityType: 'user',
    subject: byUser,
    changes: (payload) => ({ email: { from: payload.previousEmail, to: payload.email } }),
  }),
  [AUTH_EVENTS.IDENTITY_LINKED]: describe<AuthIdentityChangedEvent>({
    domain: 'account',
    entityType: 'identity',
    subject: byUser,
    metadata: (payload) => ({ provider: payload.provider }),
  }),
  [AUTH_EVENTS.IDENTITY_UNLINKED]: describe<AuthIdentityChangedEvent>({
    domain: 'account',
    entityType: 'identity',
    subject: byUser,
    metadata: (payload) => ({ provider: payload.provider }),
  }),
  [AUTH_EVENTS.PASSWORD_CHANGED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [AUTH_EVENTS.PASSWORD_RESET_REQUESTED]: describe<UserPayload>({
    domain: 'account',
    entityType: 'user',
    subject: byUser,
  }),
  [AUTH_EVENTS.SESSION_CREATED]: describe<AuthSessionCreatedEvent>({
    domain: 'account',
    entityType: 'session',
    subject: byUser,
    entityId: (payload) => payload.sessionId,
  }),
  [AUTH_EVENTS.SESSION_REVOKED]: describe<AuthSessionRevokedEvent>({
    domain: 'account',
    entityType: 'session',
    subject: byUser,
    entityId: (payload) => payload.sessionId,
    metadata: (payload) => ({ reason: payload.reason }),
  }),
  [USERS_EVENTS.USER_CREATED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [USERS_EVENTS.USER_UPDATED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [USERS_EVENTS.USER_DELETED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [USERS_EVENTS.USER_INVITED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [USERS_EVENTS.USER_BLOCKED]: describe<UserBlockedEvent>({
    domain: 'account',
    entityType: 'user',
    subject: byUser,
    metadata: (payload) => ({
      reason: payload.reason,
      until: payload.until ? payload.until.toISOString() : null,
      revokeSessions: payload.revokeSessions,
    }),
  }),
  [USERS_EVENTS.USER_UNBLOCKED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [USERS_EVENTS.USER_RESTORED]: describe<UserPayload>({ domain: 'account', entityType: 'user', subject: byUser }),
  [USERS_EVENTS.ACCOUNT_DELETION_REQUESTED]: describe<UserPayload>({
    domain: 'account',
    entityType: 'user',
    subject: byUser,
  }),
  [USERS_EVENTS.DATA_EXPORT_REQUESTED]: describe<DataExportRequestedEvent>({
    domain: 'account',
    entityType: 'data_export',
    subject: byUser,
    entityId: (payload) => payload.exportId,
  }),
  [USERS_EVENTS.DATA_EXPORT_READY]: describe<DataExportRequestedEvent>({
    domain: 'account',
    entityType: 'data_export',
    actorType: 'system',
    subject: byUser,
    entityId: (payload) => payload.exportId,
  }),
  [USERS_EVENTS.CONSENT_GIVEN]: describe<ConsentGivenEvent>({
    domain: 'account',
    entityType: 'consent',
    subject: byUser,
    entityId: (payload) => payload.type,
    metadata: (payload) => ({ type: payload.type, version: payload.version }),
  }),
  [USERS_EVENTS.CONSENT_REVOKED]: describe<ConsentRevokedEvent>({
    domain: 'account',
    entityType: 'consent',
    subject: byUser,
    entityId: (payload) => payload.type,
    metadata: (payload) => ({ type: payload.type }),
  }),

  // -------------------------------------------------------------- preferences
  [USERS_EVENTS.PREFERENCES_UPDATED]: describe<PreferencesUpdatedEvent>({
    domain: 'preferences',
    entityType: 'preferences',
    subject: byUser,
    changes: (payload) => payload.changes,
    metadata: (payload) => ({ fields: payload.changedFields }),
  }),

  // ------------------------------------------------------------------- access
  [PERMISSIONS_EVENTS.USER_PERMISSIONS_UPDATED]: describe<UserPermissionsUpdatedEvent>({
    domain: 'access',
    entityType: 'user',
    subject: byUser,
    metadata: (payload) => ({ action: payload.action, targetId: payload.targetId }),
  }),
  [PERMISSIONS_EVENTS.PERMISSION_CREATED]: permissionCatalogEvent,
  [PERMISSIONS_EVENTS.PERMISSION_UPDATED]: permissionCatalogEvent,
  [PERMISSIONS_EVENTS.PERMISSION_DELETED]: permissionCatalogEvent,
  [PERMISSIONS_EVENTS.GROUP_CREATED]: permissionGroupEvent,
  [PERMISSIONS_EVENTS.GROUP_DELETED]: permissionGroupEvent,
  [PERMISSIONS_EVENTS.GROUP_UPDATED]: describe<PermissionGroupUpdatedEvent>({
    domain: 'access',
    entityType: 'permission_group',
    subject: () => null,
    entityId: (payload) => payload.groupId,
    metadata: (payload) => ({ name: payload.name, action: payload.action, targetId: payload.targetId ?? null }),
  }),

  // ----------------------------------------------------------------- settings
  [SETTINGS_EVENTS.UPDATED]: describe<unknown>({ domain: 'settings', entityType: 'settings', subject: () => null }),

  // ------------------------------------------------------------------ athlete
  [TRAINING_EVENTS.ATHLETE_CREATED]: describe<AthletePayload>({
    domain: 'athlete',
    entityType: 'athlete',
    subject: byAthlete,
    entityId: (payload) => payload.athleteId,
  }),
  [TRAINING_EVENTS.ATHLETE_UPDATED]: describe<AthletePayload>({
    domain: 'athlete',
    entityType: 'athlete',
    subject: byAthlete,
    entityId: (payload) => payload.athleteId,
  }),
  [TRAINING_EVENTS.ATHLETE_ZONES_CHANGED]: describe<AthletePayload>({
    domain: 'athlete',
    entityType: 'athlete',
    subject: byAthlete,
    entityId: (payload) => payload.athleteId,
  }),

  // ----------------------------------------------------------------- workouts
  [TRAINING_EVENTS.WORKOUT_CREATED]: workoutEvent(),
  [TRAINING_EVENTS.WORKOUT_COMPLETED]: workoutEvent(),
  [TRAINING_EVENTS.WORKOUT_DELETED]: workoutEvent(),
  [TRAINING_EVENTS.WORKOUT_UPDATED]: describe<WorkoutUpdatedEvent>({
    domain: 'workouts',
    entityType: 'workout',
    subject: byAthlete,
    entityId: (payload) => payload.workoutId,
    changes: (payload) => payload.changes,
    metadata: (payload) => ({ fields: payload.changedFields, ...(payload.planId ? { planId: payload.planId } : {}) }),
  }),

  // -------------------------------------------------------------------- plans
  [TRAINING_EVENTS.GOAL_CREATED]: describe<GoalCreatedEvent>({
    domain: 'plans',
    entityType: 'goal',
    subject: byAthlete,
    entityId: (payload) => payload.goalId,
  }),
  [TRAINING_EVENTS.PLAN_CREATED]: planEvent((payload: PlanCreatedEvent) => ({
    status: payload.status,
    source: payload.source,
    sourcePlanId: payload.sourcePlanId ?? null,
  })),
  [TRAINING_EVENTS.PLAN_UPDATED]: planEvent((payload: PlanUpdatedEvent) => ({ kind: payload.kind })),
  [TRAINING_EVENTS.PLAN_STARTED]: planEvent((payload: PlanStartedEvent) => ({
    replacedPlanId: payload.replacedPlanId ?? null,
  })),
  [TRAINING_EVENTS.PLAN_CANCELLED]: planEvent((payload: PlanCancelledEvent) => ({
    reason: payload.reason,
    cancelledWorkouts: payload.cancelledWorkouts,
  })),
  [TRAINING_EVENTS.PLAN_COMPLETED]: describe<PlanPayload>({
    domain: 'plans',
    entityType: 'plan',
    actorType: 'system',
    subject: byAthlete,
    entityId: (payload) => payload.planId,
  }),
  [TRAINING_EVENTS.PLAN_DELETED]: planEvent(),
  [TRAINING_EVENTS.PLAN_ADAPTED]: planEvent((payload: PlanAdaptedEvent) => ({ reason: payload.reason })),
  [TRAINING_EVENTS.PLAN_ADAPTATION_DISMISSED]: describe<PlanAdaptationDismissedEvent>({
    domain: 'plans',
    entityType: 'adaptation',
    subject: byAthlete,
    entityId: (payload) => payload.adaptationId,
    metadata: (payload) => ({ planId: payload.planId }),
  }),
  [TRAINING_EVENTS.PLAN_ADAPTATION_PROPOSED]: describe<PlanAdaptationProposedEvent>({
    domain: 'plans',
    entityType: 'adaptation',
    actorType: 'coach',
    subject: byUser,
    entityId: (payload) => payload.adaptationId,
    metadata: (payload) => ({
      planId: payload.planId,
      status: payload.status,
      action: payload.action,
      changesCount: payload.changesCount,
    }),
  }),

  // --------------------------------------------------------------------- gear
  [TRAINING_EVENTS.GEAR_UPDATED]: describe<GearUpdatedEvent>({
    domain: 'gear',
    entityType: 'gear',
    subject: byUser,
    entityId: (payload) => payload.gearId,
  }),
  [TRAINING_EVENTS.GEAR_REPLACE_SOON]: describe<GearReplaceSoonEvent>({
    domain: 'gear',
    entityType: 'gear',
    actorType: 'system',
    subject: byUser,
    entityId: (payload) => payload.gearId,
    metadata: (payload) => ({ name: payload.gearName, distanceKm: payload.distanceKm, limitKm: payload.limitKm }),
  }),

  // ------------------------------------------------------------- integrations
  [INTEGRATIONS_EVENTS.CONNECTED]: describe<IntegrationConnectedEvent>({
    domain: 'integrations',
    entityType: 'integration',
    subject: byAthlete,
    entityId: (payload) => payload.integrationId,
    metadata: (payload) => ({ provider: payload.provider }),
  }),
  [INTEGRATIONS_EVENTS.DISCONNECTED]: describe<IntegrationConnectedEvent>({
    domain: 'integrations',
    entityType: 'integration',
    subject: byAthlete,
    entityId: (payload) => payload.integrationId,
    metadata: (payload) => ({ provider: payload.provider }),
  }),
  [INTEGRATIONS_EVENTS.ACTIVITY_IMPORTED]: importEvent,
  [INTEGRATIONS_EVENTS.ACTIVITY_MERGED]: importEvent,
  [INTEGRATIONS_EVENTS.ACTIVITY_UPDATED]: importEvent,
  [INTEGRATIONS_EVENTS.ACTIVITY_SOURCE_REMOVED]: importEvent,
  [INTEGRATIONS_EVENTS.SYNC_COMPLETED]: describe<DeviceSyncCompletedEvent>({
    domain: 'integrations',
    entityType: 'sync',
    actorType: 'integration',
    subject: byUser,
    entityId: (payload) => payload.syncId,
    metadata: (payload) => ({ provider: payload.provider, counters: payload.counters }),
  }),

  [INTEGRATIONS_EVENTS.SOURCE_UNLINKED]: describe<WorkoutSourceUnlinkedEvent>({
    domain: 'workouts',
    entityType: 'workout',
    subject: byAthlete,
    entityId: (payload) => payload.workoutId,
    metadata: (payload) => ({ provider: payload.provider }),
  }),
  [INTEGRATIONS_EVENTS.SYNC_REQUESTED]: describe<{ userId: string; provider: string; delivered: boolean }>({
    domain: 'integrations',
    entityType: 'integration',
    subject: byUser,
    metadata: (payload) => ({ provider: payload.provider, delivered: payload.delivered }),
  }),

  // -------------------------------------------------------------------- coach
  [COACH_EVENTS.SESSION_CREATED]: describe<CoachSessionCreatedEvent>({
    domain: 'coach',
    entityType: 'coach_session',
    subject: byUser,
    entityId: (payload) => payload.sessionId,
  }),
  [COACH_EVENTS.WORKOUT_NOTE_GENERATED]: describe<CoachWorkoutNoteGeneratedEvent>({
    domain: 'coach',
    entityType: 'workout',
    actorType: 'coach',
    subject: byUser,
    entityId: (payload) => payload.workoutId,
    metadata: (payload) => ({ noteId: payload.noteId, language: payload.language }),
  }),

  [COACH_EVENTS.WORKOUT_NOTE_DELETED]: describe<{ userId: string; workoutId: string }>({
    domain: 'coach',
    entityType: 'workout',
    subject: byUser,
    entityId: (payload) => payload.workoutId,
  }),
  [COACH_EVENTS.HISTORY_CLEARED]: describe<{ userId: string; sessions: number }>({
    domain: 'coach',
    entityType: 'coach_session',
    subject: byUser,
    metadata: (payload) => ({ sessions: payload.sessions }),
  }),

  // -------------------------------------------------------------- data access
  [ACTIVITY_EVENTS.DATA_ACCESSED]: describe<DataAccessedEvent>({
    domain: 'data_access',
    entityType: 'resource',
    subject: (payload) => (payload.subjectUserId ? { userId: payload.subjectUserId } : null),
    entityId: (payload) => payload.resourceId,
    metadata: (payload) => ({ resource: payload.resource }),
  }),
  // ------------------------------------------------------------ notifications
  [NOTIFICATIONS_EVENTS.DEVICE_REGISTERED]: describe<PushDeviceEvent>({
    domain: 'notifications',
    entityType: 'push_device',
    subject: byUser,
    entityId: (payload) => payload.deviceId,
    metadata: (payload) => ({ platform: payload.platform }),
  }),
  [NOTIFICATIONS_EVENTS.DEVICE_REMOVED]: describe<PushDeviceEvent>({
    domain: 'notifications',
    entityType: 'push_device',
    subject: byUser,
    entityId: (payload) => payload.deviceId,
    metadata: (payload) => ({ platform: payload.platform, reason: payload.reason }),
  }),
  [NOTIFICATIONS_EVENTS.BROADCAST_CREATED]: describe<BroadcastCreatedEvent>({
    domain: 'notifications',
    entityType: 'notification_broadcast',
    subject: (payload) => (payload.singleUserId ? { userId: payload.singleUserId } : null),
    entityId: (payload) => payload.broadcastId,
    metadata: (payload) => ({ audience: payload.audienceType, channels: payload.channels.join(',') }),
  }),
};

/**
 * Domain events deliberately left out of the history: derived recalculations,
 * intermediate steps already covered by another event, every single chat
 * message, and events without an identifiable user.
 */
export const ACTIVITY_IGNORED_EVENTS: ReadonlySet<string> = new Set([
  AUTH_EVENTS.EMAIL_OTP_REQUESTED,
  COACH_EVENTS.REPLY_GENERATED,
  COACH_EVENTS.PROACTIVE_MESSAGE_SENT,
  NOTIFICATIONS_EVENTS.CREATED,
  NOTIFICATIONS_EVENTS.READ,
  NOTIFICATIONS_EVENTS.DELETED,
  NOTIFICATIONS_EVENTS.BROADCAST_COMPLETED,
  INTEGRATIONS_EVENTS.SYNC_BATCH_PROCESSED,
  TRAINING_EVENTS.PROGRESS_UPDATED,
  TRAINING_EVENTS.STATE_UPDATED,
  TRAINING_EVENTS.PLAN_GENERATED,
  TRAINING_EVENTS.PLAN_METRICS_ENTERED,
  USERS_EVENTS.ACCOUNT_PURGED,
  STORAGE_EVENT_FILE_UPLOADED,
  STORAGE_EVENT_FILE_DELETED,
]);
