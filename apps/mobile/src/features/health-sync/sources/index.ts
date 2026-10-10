import { Platform } from "react-native";
import type { DeviceProvider } from "@workspace/api-client";

import type { DeviceHealthSource } from "../types";

let cached: DeviceHealthSource | null | undefined;

/**
 * The health store of this platform; null where there is none or where the
 * native module is missing from the binary (a dev client or store build made
 * before the health libraries were added, Expo Go). Loading a Nitro module
 * that is not linked throws at import time, so the import is guarded here and
 * the rest of the app keeps working.
 */
export function getHealthSource(): DeviceHealthSource | null {
  if (cached !== undefined) return cached;
  try {
    if (Platform.OS === "ios") {
      cached = (require("./apple-health-source") as typeof import("./apple-health-source")).appleHealthSource;
    } else if (Platform.OS === "android") {
      cached = (require("./health-connect-source") as typeof import("./health-connect-source")).healthConnectSource;
    } else {
      cached = null;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[HealthSync] Native health module is unavailable; rebuild the app to enable it.", error);
    }
    cached = null;
  }
  return cached;
}

export function platformHealthProvider(): DeviceProvider | null {
  if (Platform.OS === "ios") return "apple_health";
  if (Platform.OS === "android") return "health_connect";
  return null;
}
