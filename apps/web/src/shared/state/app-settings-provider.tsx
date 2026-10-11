"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";

import { fetchSettings, patchSettings } from "@/entities/settings/api";
import { notifyError } from "@/lib/notifications";
import { getFriendlyApiMessage } from "@/lib/errors";
import {
  DEFAULT_LOCALE,
  I18nProvider,
  isLocale,
  persistLocale,
  resolveStoredLocale,
  useTranslate,
  type Locale,
} from "@/shared/i18n";
import { useRealtimeClient } from "@/shared/api/realtime-provider";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemeMode, "system">;

const THEME_STORAGE_KEY = "trefix_admin_theme";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const DEFAULT_THEME: ThemeMode = "system";

type AppSettingsContextValue = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  isSyncing: boolean;
  /**
   * Pulls theme and locale from the backend.
   *
   * Exposed because this provider mounts *before* the auth one: its own
   * bootstrap runs while there is no session yet and is answered with 401. A
   * bootstrap that ran only on mount therefore never ran again for the rest of
   * the page's life, and the theme and locale stayed whatever localStorage
   * happened to hold until a reload. Auth calls this once a session exists.
   */
  syncFromBackend: () => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function resolveStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : DEFAULT_THEME;
}

/**
 * Name of the event used to notify this tab about a localStorage write.
 * The native `storage` event only fires in *other* tabs, so a same-tab write
 * needs its own signal for `useSyncExternalStore` to pick the change up.
 */
const STORED_SETTINGS_EVENT = "trefix_settings_change";

function subscribeToStoredSettings(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORED_SETTINGS_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORED_SETTINGS_EVENT, onStoreChange);
  };
}

function publishStoredSettings(): void {
  window.dispatchEvent(new Event(STORED_SETTINGS_EVENT));
}

/** Subscribes to OS-level appearance changes so `system` stays live. */
function subscribeToColorScheme(onStoreChange: () => void): () => void {
  if (!window.matchMedia) {
    return () => undefined;
  }

  const query = window.matchMedia(DARK_MEDIA_QUERY);
  query.addEventListener("change", onStoreChange);

  return () => query.removeEventListener("change", onStoreChange);
}

function persistTheme(theme: ThemeMode): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

/** Resolves the `system` mode to a concrete palette. */
export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === "system") {
    return prefersDark() ? "dark" : "light";
  }

  return theme;
}

/** Same as {@link resolveTheme} but with the OS preference already sampled. */
function resolveThemeWith(
  theme: ThemeMode,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (theme === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return theme;
}

/** Snapshots used while rendering on the server and during hydration. */
function getServerTheme(): ThemeMode {
  return DEFAULT_THEME;
}

function getServerLocale(): Locale {
  return DEFAULT_LOCALE;
}

function getServerPrefersDark(): boolean {
  return false;
}

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

/**
 * Extracts theme/locale from a realtime event payload.
 *
 * The backend wraps every broadcast in an envelope of the shape
 * `{ event, data, meta }`, so the settings snapshot lives under `data`.
 * The flat shape is accepted as a fallback for non-enveloped payloads.
 *
 * Exported for testing.
 */
export function parseRealtimeSettings(
  payload: unknown,
): { theme?: ThemeMode; locale?: Locale } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const envelope = payload as { data?: unknown; settings?: unknown };
  const source = envelope.data ?? envelope;
  if (!source || typeof source !== "object") {
    return null;
  }

  const settings = (source as { settings?: unknown }).settings ?? source;
  if (!settings || typeof settings !== "object") {
    return null;
  }

  const record = settings as { theme?: unknown; locale?: unknown };
  return {
    theme:
      record.theme === "light" ||
      record.theme === "dark" ||
      record.theme === "system"
        ? record.theme
        : undefined,
    locale: isLocale(record.locale) ? record.locale : undefined,
  };
}

export type AppSettingsProviderProps = {
  children: ReactNode;
};

/**
 * Whether reaching this auth state should (re)pull settings from the backend.
 *
 * The settings provider mounts before the auth one, so its own bootstrap runs
 * while there is still no session and is answered with 401. Something has to
 * ask again once a session exists, and the only moment that is true is the
 * transition into an authenticated state — on first load, on sign-in and after
 * an invite activation alike.
 *
 * Staying put does not re-ask: the values are already in localStorage by then,
 * and a realtime `settings.updated` covers later changes.
 *
 * Exported for testing.
 */
export function shouldSyncSettingsForAuthStatus(
  previous: string | null,
  next: string,
): boolean {
  if (next !== "authenticated") {
    return false;
  }

  return previous !== "authenticated";
}

/**
 * Global system UI state: theme and locale.
 * The backend settings storage is the source of truth; localStorage provides
 * an instant first paint, and realtime events keep every session in sync.
 */
export function AppSettingsProvider({
  children,
}: AppSettingsProviderProps): ReactElement {
  /**
   * Theme, locale and the OS colour scheme are read through
   * `useSyncExternalStore` with an explicit server snapshot.
   *
   * That is what keeps hydration deterministic: during the hydration render
   * React uses `getServerSnapshot`, so the markup is identical to what the
   * server produced, and the persisted values are picked up on the very next
   * render. Reading localStorage in a `useState` initializer instead produced a
   * hydration mismatch on every page load for anyone whose stored settings
   * differed from the defaults.
   *
   * The theme still applies before the first paint: the inline script in
   * `app/layout.tsx` sets the `dark` class on <html> while the document is
   * still parsing, which is what avoids the flash of the wrong palette.
   */
  const theme = useSyncExternalStore(
    subscribeToStoredSettings,
    resolveStoredTheme,
    getServerTheme,
  );
  const locale = useSyncExternalStore(
    subscribeToStoredSettings,
    resolveStoredLocale,
    getServerLocale,
  );
  const systemPrefersDark = useSyncExternalStore(
    subscribeToColorScheme,
    prefersDark,
    getServerPrefersDark,
  );
  const [isSyncing, setIsSyncing] = useState(true);
  const realtimeClient = useRealtimeClient();
  const t = useTranslate(locale);

  const resolvedTheme: ResolvedTheme = resolveThemeWith(
    theme,
    systemPrefersDark,
  );

  // Apply the resolved theme to the document.
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Keep the document language in sync for assistive tech and CSS `:lang()`.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Realtime subscription for control-plane updates. The socket connection
  // itself is owned by RealtimeProvider; this effect only reacts to events.
  useEffect(() => {
    if (!realtimeClient) {
      return;
    }

    return realtimeClient.on("settings.updated", (payload) => {
      const parsed = parseRealtimeSettings(payload);
      if (!parsed) {
        return;
      }

      if (parsed.theme) {
        persistTheme(parsed.theme);
      }
      if (parsed.locale) {
        persistLocale(parsed.locale);
      }

      publishStoredSettings();
    });
  }, [realtimeClient]);

  // Backend is the source of truth; local values cover the first paint only.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const syncFromBackend = useCallback(() => {
    void (async () => {
      try {
        const settings = await fetchSettings();
        if (!isMountedRef.current) {
          return;
        }

        persistTheme(settings.theme);
        persistLocale(settings.locale);
        publishStoredSettings();
      } catch {
        // Backend defaults are unavailable (e.g. no settings permission, or no
        // session yet); keep the locally persisted values.
      } finally {
        if (isMountedRef.current) {
          setIsSyncing(false);
        }
      }
    })();
  }, []);

  useEffect(() => {
    syncFromBackend();
  }, [syncFromBackend]);

  const setTheme = useCallback(
    (next: ThemeMode) => {
      persistTheme(next);
      publishStoredSettings();

      patchSettings({ theme: next }).catch((error) => {
        notifyError(t("settings.title"), getFriendlyApiMessage(error, t));
      });
    },
    [t],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      persistLocale(next);
      publishStoredSettings();

      patchSettings({ locale: next }).catch((error) => {
        notifyError(t("settings.title"), getFriendlyApiMessage(error, t));
      });
    },
    [t],
  );

  const settingsValue = useMemo<AppSettingsContextValue>(
    () => ({ theme, resolvedTheme, setTheme, isSyncing, syncFromBackend }),
    [theme, resolvedTheme, setTheme, isSyncing, syncFromBackend],
  );

  return (
    <AppSettingsContext.Provider value={settingsValue}>
      <I18nProvider locale={locale} onLocaleChange={setLocale}>
        {children}
      </I18nProvider>
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const value = useContext(AppSettingsContext);

  if (!value) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }

  return value;
}
