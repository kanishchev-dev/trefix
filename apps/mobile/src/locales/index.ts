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
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ru: ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"],
};

const longMonthByLanguage: Record<AppLanguage, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
};

export function formatProfileJoinedDate(date: Date, language: AppLanguage): string {
  const month = shortMonthByLanguage[language][date.getMonth()];
  const year = date.getFullYear();
  return language === "ru"
    ? `Зарегистрирован в ${month} ${year}`
    : `Registered ${month} ${year}`;
}

export function formatProfileExpiryDate(date: Date, language: AppLanguage): string {
  const day = date.getDate();
  const month = longMonthByLanguage[language][date.getMonth()];
  const year = date.getFullYear();
  return language === "ru"
    ? `Истекает ${day} ${month} ${year}`
    : `Expires ${month} ${day}, ${year}`;
}
