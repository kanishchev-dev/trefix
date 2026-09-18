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
