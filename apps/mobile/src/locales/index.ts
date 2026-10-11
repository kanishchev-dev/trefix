import * as Localization from "expo-localization";

import authCopyEn from "./auth/en.json";
import authCopyRu from "./auth/ru.json";
import mainCopyEn from "./main/en.json";
import mainCopyRu from "./main/ru.json";

export type AppLanguage = "en" | "ru";

export type AuthCopy = typeof authCopyEn;
export type MainCopy = typeof mainCopyEn;

const authLocaleMap: Record<AppLanguage, AuthCopy> = {
  en: authCopyEn,
  ru: authCopyRu,
};

const mainLocaleMap: Record<AppLanguage, MainCopy> = {
  en: mainCopyEn,
  ru: mainCopyRu,
};

export function getAppLanguage(): AppLanguage {
  const languageCode =
    Localization.getLocales()[0]?.languageCode?.toLowerCase();
  return languageCode === "ru" ? "ru" : "en";
}

export function getAuthCopy(language: AppLanguage): AuthCopy {
  return authLocaleMap[language];
}

export function getMainCopy(language: AppLanguage): MainCopy {
  return mainLocaleMap[language];
}

export function formatCountdown(secondsRemaining: number): string {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const shortMonthByLanguage: Record<AppLanguage, string[]> = {
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  ru: [
    "янв",
    "фев",
    "мар",
    "апр",
    "май",
    "июн",
    "июл",
    "авг",
    "сен",
    "окт",
    "ноя",
    "дек",
  ],
};

const fullMonthByLanguage: Record<AppLanguage, string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  ru: [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ],
};

const shortDayByLanguage: Record<AppLanguage, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
};

export function formatMonthYear(date: Date, language: AppLanguage): string {
  const month = fullMonthByLanguage[language][date.getMonth()];
  const year = date.getFullYear();
  return `${month} ${year}`;
}

export function getShortDayName(
  dayIndex: number,
  language: AppLanguage,
): string {
  return shortDayByLanguage[language][dayIndex];
}

export function getShortMonthName(
  monthIndex: number,
  language: AppLanguage,
): string {
  return shortMonthByLanguage[language][monthIndex];
}

const shortMonthByLanguageLocative: Record<AppLanguage, string[]> = {
  ru: [
    "январе",
    "феврале",
    "марте",
    "апреле",
    "мае",
    "июне",
    "июле",
    "августе",
    "сентябре",
    "октябре",
    "ноябре",
    "декабре",
  ],
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
};

const longMonthByLanguageGenitive: Record<AppLanguage, string[]> = {
  ru: [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

export function formatProfileJoinedDate(
  date: Date,
  language: AppLanguage,
): string {
  const month = shortMonthByLanguageLocative[language][date.getMonth()];
  const year = date.getFullYear();
  return language === "ru"
    ? `Зарегистрирован в ${month} ${year}`
    : `Registered ${month} ${year}`;
}

export function formatProfileExpiryDate(
  date: Date,
  language: AppLanguage,
): string {
  const day = date.getDate();
  const month = longMonthByLanguageGenitive[language][date.getMonth()];
  const year = date.getFullYear();
  return language === "ru"
    ? `Истекает ${day} ${month} ${year}`
    : `Expires ${month} ${day}, ${year}`;
}

export function formatDateLong(date: Date, language: AppLanguage): string {
  const day = date.getDate();
  const month = longMonthByLanguageGenitive[language][date.getMonth()];
  return language === "ru" ? `${day} ${month}` : `${month} ${day}`;
}

/** Replaces `{{name}}` placeholders in a localized template. */
export function fillTemplate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** Plural forms of a localized phrase; `{{count}}` is substituted. */
export type PluralForms = {
  one: string;
  few?: string;
  many?: string;
  other: string;
};

function pluralCategory(
  count: number,
  language: AppLanguage,
): keyof PluralForms {
  const value = Math.abs(Math.trunc(count));
  if (language === "ru") {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return "one";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  }
  return value === 1 ? "one" : "other";
}

export function pluralize(
  forms: PluralForms,
  count: number,
  language: AppLanguage,
  params: Record<string, string | number> = {},
): string {
  const category = pluralCategory(count, language);
  const template = forms[category] ?? forms.other;
  return fillTemplate(template, { count, ...params });
}

function parseDateInput(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Date-only strings are calendar dates, not UTC instants.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match)
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

/** dd.MM.yy (ru) / MM/dd/yy (en). */
export function formatShortDate(
  value: string | Date,
  language: AppLanguage,
): string {
  const date = parseDateInput(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return language === "ru"
    ? `${day}.${month}.${year}`
    : `${month}/${day}/${year}`;
}

/** "1 мар" / "Mar 1". */
export function formatDayMonth(
  value: string | Date,
  language: AppLanguage,
): string {
  const date = parseDateInput(value);
  const month = shortMonthByLanguage[language][date.getMonth()];
  return language === "ru"
    ? `${date.getDate()} ${month}`
    : `${month} ${date.getDate()}`;
}

/** Pace in seconds per km as m:ss. */
export { formatMinutesSeconds as formatPace } from "@workspace/utils";
