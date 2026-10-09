import { NativeModules } from "react-native";

const CONFIGURED_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_AUTH_BACKEND_URL ||
  "http://127.0.0.1:3000/v1";

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/** Host the JS bundle was loaded from (the Metro dev server). */
function devServerHost(): string | null {
  try {
    const sourceCode = NativeModules.SourceCode as
      | { getConstants?: () => { scriptURL?: string }; scriptURL?: string }
      | undefined;
    const scriptUrl = sourceCode?.getConstants?.().scriptURL ?? sourceCode?.scriptURL;
    const match = typeof scriptUrl === "string" ? /^https?:\/\/([^/:]+)/.exec(scriptUrl) : null;
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Backend base URL. In development a local backend URL follows the dev
 * server's host: the device already reaches Metro there, so the API on the same
 * machine is reachable too, even after the Mac's LAN IP changes.
 */
function resolveBackendUrl(): string {
  if (!__DEV__) return CONFIGURED_URL;
  const configuredHost = /^https?:\/\/([^/:]+)/.exec(CONFIGURED_URL)?.[1] ?? null;
  const host = devServerHost();
  if (!host || !configuredHost || !LOCAL_HOST.test(configuredHost) || !LOCAL_HOST.test(host)) {
    return CONFIGURED_URL;
  }
  return CONFIGURED_URL.replace(/^(https?:\/\/)[^/:]+/, `$1${host}`);
}

export const BACKEND_BASE_URL = resolveBackendUrl();

if (__DEV__ && BACKEND_BASE_URL !== CONFIGURED_URL) {
  console.log(`[API] Backend URL follows the dev server: ${BACKEND_BASE_URL} (configured ${CONFIGURED_URL})`);
}
