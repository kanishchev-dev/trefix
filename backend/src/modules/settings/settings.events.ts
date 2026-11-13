/**
 * Names of in-process domain events published by the settings module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const SETTINGS_EVENTS = {
  UPDATED: 'settings.updated',
} as const;

export type SettingsEventName = (typeof SETTINGS_EVENTS)[keyof typeof SETTINGS_EVENTS];
