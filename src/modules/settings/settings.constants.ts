export const SETTINGS_KEY_DEFAULT_GROUPS = 'defaultGroups';
export const SETTINGS_KEY_DEFAULT_PERMISSIONS = 'defaultPermissions';
export const SETTINGS_KEY_THEME = 'theme';
export const SETTINGS_KEY_LOCALE = 'locale';

export const SETTINGS_THEME_MODES = ['light', 'dark', 'system'] as const;
export const SETTINGS_LOCALES = ['ru', 'en'] as const;

export type SettingsThemeMode = (typeof SETTINGS_THEME_MODES)[number];
export type SettingsLocale = (typeof SETTINGS_LOCALES)[number];

export const SETTINGS_ROOM = 'settings';
export const SETTINGS_REALTIME_EVENT = 'settings.updated';

export interface AppSettingsSnapshot {
  defaultGroups: string[];
  defaultPermissions: string[];
  theme: SettingsThemeMode;
  locale: SettingsLocale;
}

export const DEFAULT_APP_SETTINGS: AppSettingsSnapshot = {
  defaultGroups: [],
  defaultPermissions: [],
  theme: 'system',
  locale: 'en',
};
