/**
 * Names of in-process domain events published by the users (accounts, consents, preferences, deletion) module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const USERS_EVENTS = {
  ACCOUNT_DELETION_REQUESTED: 'account.deletion_requested',
  PREFERENCES_UPDATED: 'preferences.updated',
  USER_CREATED: 'user.created',
  USER_DELETED: 'user.deleted',
  USER_INVITED: 'user.invited',
  USER_UPDATED: 'user.updated',
  CONSENT_GIVEN: 'users.consent_given',
  CONSENT_REVOKED: 'users.consent_revoked',
} as const;

export type UsersEventName = (typeof USERS_EVENTS)[keyof typeof USERS_EVENTS];
