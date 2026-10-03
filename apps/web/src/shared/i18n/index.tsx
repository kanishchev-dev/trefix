"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";

import en from "./locales/en.json";
import ru from "./locales/ru.json";

export type Locale = "ru" | "en";

export const LOCALES: Locale[] = ["ru", "en"];
export const DEFAULT_LOCALE: Locale = "en";

const DICTIONARIES: Record<Locale, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  ru: ru as unknown as Record<string, unknown>,
};

const LOCALE_STORAGE_KEY = "trefix_admin_locale";

export function resolveStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en";
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(locale: Locale, key: string): string | undefined {
  const dictionary = DICTIONARIES[locale];
  const segments = key.split(".");
  let current: unknown = dictionary;

  for (const segment of segments) {
    if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type I18nProviderProps = {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  children: ReactNode;
};

export function I18nProvider({
  locale,
  onLocaleChange,
  children,
}: I18nProviderProps): ReactElement {
  const setLocale = useCallback(
    (next: Locale) => {
      onLocaleChange(next);
    },
    [onLocaleChange],
  );

  const t = useCallback<TranslateFn>(
    (key, params) => {
      const translated = lookup(locale, key) ?? lookup("en", key) ?? key;
      return interpolate(translated, params);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return value;
}

/**
 * Builds a translate function bound to an explicit locale.
 *
 * Useful for components that must translate before (or outside of) the
 * I18nProvider subtree, e.g. providers that own the locale themselves.
 */
export function useTranslate(locale: Locale): TranslateFn {
  return useCallback<TranslateFn>(
    (key, params) => {
      const translated = lookup(locale, key) ?? lookup("en", key) ?? key;
      return interpolate(translated, params);
    },
    [locale],
  );
}

export function formatDate(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) {
    return "—";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
