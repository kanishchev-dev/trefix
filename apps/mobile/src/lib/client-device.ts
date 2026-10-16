import * as Device from "expo-device";
import { Platform } from "react-native";

import appConfig from "../../app.json";

/** What the backend shows for this session on the "Devices" list. */
export function clientDeviceHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "x-client-platform": Platform.OS,
    "x-client-app-version": appConfig.expo.version ?? "1.0.0",
  };
  const name = Device.modelName ?? Device.deviceName;
  if (name) {
    headers["x-client-device"] = name;
  }
  return headers;
}
