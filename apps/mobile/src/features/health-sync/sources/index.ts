import { Platform, TurboModuleRegistry } from "react-native";
import type { DeviceProvider } from "@workspace/api-client";

import type { DeviceHealthSource } from "../types";
import { logger } from "../../../lib/logger";

let cached: DeviceHealthSource | null | undefined;

/**
 * Whether this binary contains the native side of the platform's health
 * library. A build made before the libraries were added (or Expo Go) lacks it.
 *
 * This must be decided before `require`: in development Metro reports an
 * error thrown while a module initializes as fatal (red screen) and does not
 * rethrow it, so a try/catch around `require` cannot keep the app alive.
 */
function hasNativeHealthModule(): boolean {
  try {
    if (Platform.OS === "android") {
      return TurboModuleRegistry.get("HealthConnect") != null;
    }
    if (Platform.OS === "ios") {
      if (TurboModuleRegistry.get("NitroModules") == null) return false;
      // Nitro is linked, so loading it is safe; HealthKit registers its hybrid objects there.
      const { NitroModules } =
        require("react-native-nitro-modules") as typeof import("react-native-nitro-modules");
      return (
        NitroModules.hasHybridObject("CoreModule") &&
        NitroModules.hasHybridObject("WorkoutsModule")
      );
    }
  } catch {
    return false;
  }
  return false;
}

/** The health store of this platform; null where there is none or where the native module is missing. */
export function getHealthSource(): DeviceHealthSource | null {
  if (cached !== undefined) return cached;
  if (!hasNativeHealthModule()) {
    if (__DEV__) {
      logger.warn(
        "[HealthSync] Native health module is not in this build; rebuild the app (expo run:ios / run:android).",
      );
    }
    cached = null;
    return cached;
  }
  try {
    if (Platform.OS === "ios") {
      cached = (
        require("./apple-health-source") as typeof import("./apple-health-source")
      ).appleHealthSource;
    } else if (Platform.OS === "android") {
      cached = (
        require("./health-connect-source") as typeof import("./health-connect-source")
      ).healthConnectSource;
    } else {
      cached = null;
    }
  } catch {
    cached = null;
  }
  return cached ?? null;
}

export function platformHealthProvider(): DeviceProvider | null {
  if (Platform.OS === "ios") return "apple_health";
  if (Platform.OS === "android") return "health_connect";
  return null;
}
