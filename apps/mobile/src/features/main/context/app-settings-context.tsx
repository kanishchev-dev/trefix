import { createContext, useContext, type ReactNode } from "react";

import { type LanguageMode } from "../../../app/use-app-preferences";
import { type AppLanguage } from "../../../locales";
import { type ThemePreference } from "../screens/theme-settings-screen";

/** Device-level settings and session actions the settings screens need. */
export type AppSettings = {
  language: AppLanguage;
  languageMode: LanguageMode;
  userTheme: ThemePreference;
  userEmail: string;
  selectLanguage: (mode: LanguageMode) => void;
  selectTheme: (theme: ThemePreference) => void;
  logout: () => void;
  accountDeleted: () => void;
};

const AppSettingsContext = createContext<AppSettings | null>(null);

export function AppSettingsProvider({
  value,
  children,
}: {
  value: AppSettings;
  children: ReactNode;
}) {
  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettings {
  const value = useContext(AppSettingsContext);
  if (!value) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }
  return value;
}
