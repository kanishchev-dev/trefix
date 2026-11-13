import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import { type MainCopy } from "../../../locales";
import { openNotificationLink } from "../lib/open-notification-link";
import { useAppBadge, usePushRegistration, usePushTaps } from "../push";
import {
  notificationKeys,
  useMarkNotificationsRead,
  useNotificationsRealtime,
  useUnreadNotificationsCount,
} from "./use-notifications";

/**
 * Everything the signed-in app does for notifications in the background:
 * registers for pushes, keeps the badge in sync and opens tapped pushes.
 */
export function useNotificationsBootstrap(
  copy: MainCopy,
  language: string,
  openTrefix: () => void,
): void {
  const queryClient = useQueryClient();
  const markRead = useMarkNotificationsRead();
  const unread = useUnreadNotificationsCount();

  useNotificationsRealtime();
  usePushRegistration(language, copy.inbox.channelName);
  useAppBadge(unread);

  usePushTaps((data) => {
    if (data.notificationId) {
      markRead.mutate([data.notificationId]);
    }
    openNotificationLink(data.link ?? null, { openTrefix });
  });

  // A push received while the realtime connection is down still refreshes the inbox.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });
    return () => subscription.remove();
  }, [queryClient]);
}
