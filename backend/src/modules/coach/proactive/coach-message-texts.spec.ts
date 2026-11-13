import { Test } from '@nestjs/testing';
import { I18nModule } from 'nestjs-i18n';
import * as path from 'path';

import { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';

import { CoachMessageTexts } from './coach-message-texts';

describe('CoachMessageTexts', () => {
  const languages: Record<string, string | null> = { 'user-ru': 'ru', 'user-en': 'en', 'user-unset': null };
  let texts: CoachMessageTexts;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        I18nModule.forRoot({
          fallbackLanguage: 'en',
          loaderOptions: { path: path.join(__dirname, '../../../../i18n/'), watch: false },
        }),
      ],
      providers: [
        CoachMessageTexts,
        {
          provide: UserPreferencesService,
          useValue: {
            getEntity: async (userId: string): Promise<{ language: string | null }> => ({
              language: languages[userId],
            }),
          },
        },
      ],
    }).compile();
    texts = moduleRef.get(CoachMessageTexts);
  });

  it('writes in the language the user chose in the app', async () => {
    const english = await texts.adaptation('user-en', 'REDUCE_VOLUME', true);
    const russian = await texts.adaptation('user-ru', 'REDUCE_VOLUME', true);

    expect(english).toBe(
      'I suggest we reduce the volume of the next workouts. Confirm the change in the Plan section — the plan stays as it is until you say yes.',
    );
    expect(russian).toContain('снизить объём ближайших тренировок');
  });

  it('falls back to Russian for users whose app never reported a language', async () => {
    await expect(texts.adaptation('user-unset', 'MOVE', false)).resolves.toBe(
      'Совет: стоит перенести тренировку. План я не меняю — решите сами, нужно ли это.',
    );
  });

  it('uses a generic wording for an unknown action and a default gear name', async () => {
    await expect(texts.adaptation('user-en', 'SOMETHING_NEW', false)).resolves.toContain('adjust the plan');
    await expect(texts.gearReplaceSoon('user-en', { gearName: null, distanceKm: 712, limitKm: 800 })).resolves.toMatch(
      /^Your shoes have already run 712 km of 800\./,
    );
  });
});
