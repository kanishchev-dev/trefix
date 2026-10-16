/**
 * Names of in-process domain events published by the users (accounts, consents, preferences, deletion) module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const USERS_EVENTS = {
  ACCOUNT_DELETION_REQUESTED: 'account.deletion_requested',
  ACCOUNT_PURGED: 'account.purged',
  DATA_EXPORT_REQUESTED: 'account.data_export_requested',
  DATA_EXPORT_READY: 'account.data_export_ready',
  PREFERENCES_UPDATED: 'preferences.updated',
  USER_CREATED: 'user.created',
  USER_DELETED: 'user.deleted',
  USER_INVITED: 'user.invited',
  USER_UPDATED: 'user.updated',
  USER_BLOCKED: 'users.blocked',
  USER_UNBLOCKED: 'users.unblocked',
  USER_RESTORED: 'users.deletion_restored',
  CONSENT_GIVEN: 'users.consent_given',
  CONSENT_REVOKED: 'users.consent_revoked',
} as const;

export type UsersEventName = (typeof USERS_EVENTS)[keyof typeof USERS_EVENTS];
