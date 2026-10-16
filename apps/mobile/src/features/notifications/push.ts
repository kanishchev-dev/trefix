import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import type { NotificationLink } from "@trefix/api-client";

import appConfig from "../../../app.json";
import { logger } from "../../lib/logger";
import { registerPushDevice } from "../../lib/notifications-api";

const ANDROID_CHANNEL_ID = "default";

/** Notifications that arrive while the app is open still show a banner. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushPermission = "granted" | "denied" | "undetermined";

export async function getPushPermission(): Promise<PushPermission> {
  try {
    const status = await Notifications.getPermissionsAsync();
    if (status.granted) return "granted";
    return status.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}

async function ensureAndroidChannel(name: string): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name,
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/**
 * Sends the Expo token of this installation to the backend. Needs a physical
 * device, the EAS project id and the user's permission; without any of them
 * the app keeps working with the in-app inbox only.
 */
async function registerToken(
  language: string,
  channelName: string,
): Promise<string | null> {
  if (!Device.isDevice) return null;
  await ensureAndroidChannel(channelName);
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } catch (error) {
    // Expo Go on Android and builds without an EAS project id cannot get a token.
    logger.warn("Push token is unavailable:", error);
    return null;
  }
  await registerPushDevice({
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
    locale: language,
    appVersion: appConfig.expo.version ?? null,
    deviceName: Device.modelName ?? null,
  });
  return token;
}

/** Asks for the permission (once the system allows it) and registers the device. */
export async function requestPushPermission(
  language: string,
  channelName: string,
): Promise<PushPermission> {
  const current = await getPushPermission();
  if (current === "undetermined") {
    await Notifications.requestPermissionsAsync();
  }
  const next = await getPushPermission();
  if (next === "granted") {
    await registerToken(language, channelName).catch((error) =>
      logger.warn("Push registration failed:", error),
    );
  }
  return next;
}

/**
 * Registers the device on start and whenever the app returns to the
 * foreground (the permission may have been granted in the system settings).
 * Never prompts by itself.
 */
export function usePushRegistration(
  language: string,
  channelName: string,
): void {
  const registered = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      if ((await getPushPermission()) !== "granted" || cancelled) return;
      const key = `${language}`;
      if (registered.current === key) return;
      try {
        if (await registerToken(language, channelName)) {
          registered.current = key;
        }
      } catch (error) {
        logger.warn("Push registration failed:", error);
      }
    };
    void sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [language, channelName]);
}

type PushData = { notificationId?: string; link?: NotificationLink | null };

/** Calls `onOpen` for a tapped push, including the one that launched the app. */
export function usePushTaps(onOpen: (data: PushData) => void): void {
  const handler = useRef(onOpen);
  handler.current = onOpen;

  useEffect(() => {
    const handled = new Set<string>();
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      handler.current(
        (response.notification.request.content.data ?? {}) as PushData,
      );
    };
    open(Notifications.getLastNotificationResponse());
    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);
}

/** The app icon badge mirrors the unread count of the inbox. */
export function useAppBadge(unread: number): void {
  useEffect(() => {
    Notifications.setBadgeCountAsync(unread).catch(() => undefined);
  }, [unread]);
}
