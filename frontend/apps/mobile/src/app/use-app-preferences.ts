import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type AuthTokens } from "@trefix/api-client";

import { type ThemePreference } from "../features/main/screens/theme-settings-screen";
import { setRequestLanguage } from "../lib/api-client";
import { logger } from "../lib/logger";
import { updatePreferences } from "../lib/preferences-api";
import { getAppLanguage, type AppLanguage } from "../locales";

export const LANGUAGE_STORAGE_KEY = "@trefix/language";

/** What the user picked: a language or "follow the device". */
export type LanguageMode = "system" | AppLanguage;
export const THEME_STORAGE_KEY = "@trefix/theme";

/**
 * Language and theme chosen on this device. The backend answers (error
 * messages) and writes (coach messages, emails) in the app language, so the
 * language is also sent with every request and reported once per session.
 */
export function useAppPreferences(session: AuthTokens | null) {
  const [languageMode, setLanguageMode] = useState<LanguageMode>("system");
  const [userTheme, setUserTheme] = useState<ThemePreference>("system");
  const [arePreferencesLoaded, setArePreferencesLoaded] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const storedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (
          storedLang === "ru" ||
          storedLang === "en" ||
          storedLang === "system"
        ) {
          setLanguageMode(storedLang);
        }
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (
          storedTheme === "system" ||
          storedTheme === "dark" ||
          storedTheme === "light"
        ) {
          setUserTheme(storedTheme);
        }
      } catch (error) {
        logger.warn("Failed to load user preferences:", error);
      } finally {
        setArePreferencesLoaded(true);
      }
    }
    void loadPreferences();
  }, []);

  const language: AppLanguage =
    languageMode === "system" ? getAppLanguage() : languageMode;
  const reportedLanguageRef = useRef<string | null>(null);

  useEffect(() => {
    setRequestLanguage(language);
    if (!session || !arePreferencesLoaded) {
      return;
    }
    const reportKey = `${session.sessionId}:${language}:${languageMode}`;
    if (reportedLanguageRef.current === reportKey) {
      return;
    }
    reportedLanguageRef.current = reportKey;
    updatePreferences({ language, languageMode }).catch((error: unknown) => {
      reportedLanguageRef.current = null;
      logger.warn("Failed to report the app language:", error);
    });
  }, [session, language, languageMode, arePreferencesLoaded]);

  const selectLanguage = (nextMode: LanguageMode) => {
    setLanguageMode(nextMode);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextMode);
  };

  const selectTheme = (nextTheme: ThemePreference) => {
    setUserTheme(nextTheme);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return { language, languageMode, userTheme, selectLanguage, selectTheme };
}
