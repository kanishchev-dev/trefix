import { I18nContext } from 'nestjs-i18n';

import type { PreferenceLanguage } from '@/modules/users/users.constants';

import { normalizeLanguage } from './notification-texts';
import { NOTIFICATIONS_FALLBACK_LANGUAGE } from './notifications.constants';

/** Language of the current request (Accept-Language), for texts written in several languages. */
export function requestLanguage(): PreferenceLanguage {
  return normalizeLanguage(I18nContext.current()?.lang) ?? NOTIFICATIONS_FALLBACK_LANGUAGE;
}
