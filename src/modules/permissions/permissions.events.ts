/**
 * Names of in-process domain events published by the permissions module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const PERMISSIONS_EVENTS = {
  GROUP_CREATED: 'permission-group.created',
  GROUP_DELETED: 'permission-group.deleted',
  GROUP_UPDATED: 'permission-group.updated',
  PERMISSION_CREATED: 'permission.created',
  PERMISSION_DELETED: 'permission.deleted',
  PERMISSION_UPDATED: 'permission.updated',
  USER_PERMISSIONS_UPDATED: 'user-permissions.updated',
} as const;

export type PermissionsEventName = (typeof PERMISSIONS_EVENTS)[keyof typeof PERMISSIONS_EVENTS];
