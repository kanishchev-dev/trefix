import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';
import { type PreferenceLanguage } from '@/modules/users/users.constants';

/**
 * Language of coach messages for users whose app never reported one. Coach
 * messages are written without a request, so there is no Accept-Language to
 * follow; Russian is the language of the product's primary audience.
 */
const COACH_FALLBACK_LANGUAGE: PreferenceLanguage = 'ru';

/** Renders proactive coach texts in the language the user chose in the app. */
@Injectable()
export class CoachMessageTexts {
  constructor(
    private readonly i18n: I18nService,
    private readonly preferencesService: UserPreferencesService,
  ) {}

  async gearReplaceSoon(
    userId: string,
    args: { gearName: string | null; distanceKm: number; limitKm: number },
  ): Promise<string> {
    const lang = await this.languageOf(userId);
    const gearName = args.gearName || this.t('coach.PROACTIVE.DEFAULT_GEAR_NAME', lang);
    return this.t('coach.PROACTIVE.GEAR_REPLACE_SOON', lang, { ...args, gearName });
  }

  /** `proposed` waits for the user's confirmation; otherwise the change is only advice. */
  async adaptation(userId: string, action: string, proposed: boolean): Promise<string> {
    const lang = await this.languageOf(userId);
    const actionKey = `coach.ADAPTATION_ACTIONS.${action}`;
    const actionText = this.t(actionKey, lang, {}, this.t('coach.ADAPTATION_ACTIONS.DEFAULT', lang));
    const key = proposed ? 'coach.PROACTIVE.ADAPTATION_PROPOSED' : 'coach.PROACTIVE.ADAPTATION_SUGGESTED';
    return this.t(key, lang, { action: actionText });
  }

  private async languageOf(userId: string): Promise<PreferenceLanguage> {
    return (await this.preferencesService.getEntity(userId)).language ?? COACH_FALLBACK_LANGUAGE;
  }

  private t(key: string, lang: string, args: Record<string, unknown> = {}, defaultValue?: string): string {
    return this.i18n.translate(key, { lang, args, defaultValue }) as string;
  }
}
