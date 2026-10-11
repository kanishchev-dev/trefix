import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type AuthTokens } from "@workspace/api-client";

import { type ThemePreference } from "../features/main/screens/theme-settings-screen";
import { setRequestLanguage } from "../lib/api-client";
import { logger } from "../lib/logger";
import { updatePreferences } from "../lib/preferences-api";
import { getAppLanguage, type AppLanguage } from "../locales";

export const LANGUAGE_STORAGE_KEY = "@trefix/language";
export const THEME_STORAGE_KEY = "@trefix/theme";

/**
 * Language and theme chosen on this device. The backend answers (error
 * messages) and writes (coach messages, emails) in the app language, so the
 * language is also sent with every request and reported once per session.
 */
export function useAppPreferences(session: AuthTokens | null) {
  const [userLanguage, setUserLanguage] = useState<AppLanguage | null>(null);
  const [userTheme, setUserTheme] = useState<ThemePreference>("system");
  const [arePreferencesLoaded, setArePreferencesLoaded] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const storedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (storedLang === "ru" || storedLang === "en") {
          setUserLanguage(storedLang);
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

  const language: AppLanguage = userLanguage ?? getAppLanguage();
  const reportedLanguageRef = useRef<string | null>(null);

  useEffect(() => {
    setRequestLanguage(language);
    if (!session || !arePreferencesLoaded) {
      return;
    }
    const reportKey = `${session.sessionId}:${language}`;
    if (reportedLanguageRef.current === reportKey) {
      return;
    }
    reportedLanguageRef.current = reportKey;
    updatePreferences({ language }).catch((error: unknown) => {
      reportedLanguageRef.current = null;
      logger.warn("Failed to report the app language:", error);
    });
  }, [session, language, arePreferencesLoaded]);

  const selectLanguage = (nextLanguage: AppLanguage) => {
    setUserLanguage(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const selectTheme = (nextTheme: ThemePreference) => {
    setUserTheme(nextTheme);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return { language, userTheme, selectLanguage, selectTheme };
}
