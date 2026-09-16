import * as Localization from "expo-localization";

import authCopyEn from "./auth/en.json";
import authCopyRu from "./auth/ru.json";

export type AppLanguage = "en" | "ru";

export type AuthCopy = typeof authCopyEn;

const localeMap: Record<AppLanguage, AuthCopy> = {
  en: authCopyEn,
  ru: authCopyRu,
};

export function getAppLanguage(): AppLanguage {
  const languageCode = Localization.getLocales()[0]?.languageCode?.toLowerCase();
  return languageCode === "ru" ? "ru" : "en";
}

export function getAuthCopy(language: AppLanguage): AuthCopy {
  return localeMap[language];
}

export function formatCountdown(secondsRemaining: number): string {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
