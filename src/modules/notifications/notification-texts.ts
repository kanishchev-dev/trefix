import { PREFERENCE_LANGUAGES, type PreferenceLanguage } from '@/modules/users/users.constants';

import type { NotificationContent, NotificationText } from './notifications.constants';

/** `ru-RU`, `en_US`, `EN` → a supported language, or `null`. */
export function normalizeLanguage(value: string | null | undefined): PreferenceLanguage | null {
  if (!value) {
    return null;
  }
  const code = value.slice(0, 2).toLowerCase();
  return (PREFERENCE_LANGUAGES as readonly string[]).includes(code) ? (code as PreferenceLanguage) : null;
}

/** The text in the reader's language, or in any language the sender wrote it in. */
export function pickText(content: NotificationContent, language: PreferenceLanguage): NotificationText | null {
  const own = content[language];
  if (own?.body) {
    return own;
  }
  for (const candidate of PREFERENCE_LANGUAGES) {
    const text = content[candidate];
    if (text?.body) {
      return text;
    }
  }
  return null;
}
