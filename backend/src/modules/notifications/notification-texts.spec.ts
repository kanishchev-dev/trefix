import { normalizeLanguage, pickText } from './notification-texts';

describe('notification texts', () => {
  it('normalizes locales to supported languages', () => {
    expect(normalizeLanguage('ru-RU')).toBe('ru');
    expect(normalizeLanguage('EN_us')).toBe('en');
    expect(normalizeLanguage('de')).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
  });

  it('picks the reader language and falls back to any written one', () => {
    const content = { ru: { title: 'Привет', body: 'Текст' } };
    expect(pickText(content, 'ru')).toEqual({ title: 'Привет', body: 'Текст' });
    expect(pickText(content, 'en')).toEqual({ title: 'Привет', body: 'Текст' });
    expect(pickText({}, 'en')).toBeNull();
  });
});
