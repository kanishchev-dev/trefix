import { Linking } from "react-native";

import type { NotificationLink } from "@trefix/api-client";

import {
  openStackScreen,
  openTab,
  pushSubScreen,
} from "../../main/main-routes";

/** Opens what a notification points at; a notification without a link opens the inbox. */
export function openNotificationLink(
  link: NotificationLink | null | undefined,
  options: { openTrefix: () => void },
): void {
  switch (link?.target) {
    case "coach":
      options.openTrefix();
      return;
    case "today":
      openTab("today");
      return;
    case "workout":
      if (link.id) {
        pushSubScreen({ kind: "workout-details", workoutId: link.id });
      } else {
        openTab("today");
      }
      return;
    case "plan":
      if (link.id) {
        pushSubScreen({ kind: "plan-details", planId: link.id });
      } else {
        openTab("plan");
      }
      return;
    case "progress":
      openTab("progress");
      return;
    case "profile":
      openTab("profile");
      return;
    case "url":
      if (link.url?.startsWith("https://")) {
        void Linking.openURL(link.url);
      }
      return;
    default:
      openStackScreen("notifications");
  }
}

/** Whether a tap on the entry leads anywhere besides marking it read. */
export function hasDestination(link: NotificationLink | null): boolean {
  return Boolean(link && (link.target !== "url" || link.url));
}
