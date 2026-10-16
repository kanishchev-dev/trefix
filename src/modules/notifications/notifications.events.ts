/**
 * Names of in-process domain events published by the notifications module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const NOTIFICATIONS_EVENTS = {
  CREATED: 'notifications.created',
  READ: 'notifications.read',
  DELETED: 'notifications.deleted',
  DEVICE_REGISTERED: 'notifications.device_registered',
  DEVICE_REMOVED: 'notifications.device_removed',
  BROADCAST_CREATED: 'notifications.broadcast_created',
  BROADCAST_COMPLETED: 'notifications.broadcast_completed',
} as const;

export type NotificationsEventName = (typeof NOTIFICATIONS_EVENTS)[keyof typeof NOTIFICATIONS_EVENTS];
