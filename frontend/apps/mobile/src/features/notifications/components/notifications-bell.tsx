import { StyleSheet, View } from "react-native";
import { Bell } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import { HeaderActionButton } from "../../main/components/header-buttons";
import { openStackScreen } from "../../main/main-routes";
import { useUnreadNotificationsCount } from "../hooks/use-notifications";

/** Header bell that opens the inbox; a dot marks unread notifications. */
export function NotificationsBellButton({
  theme,
  themeMode,
  copy,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
}) {
  const unread = useUnreadNotificationsCount();
  return (
    <HeaderActionButton
      accessibilityLabel={
        unread > 0
          ? fillTemplate(copy.inbox.bellLabelUnread, { count: unread })
          : copy.inbox.bellLabel
      }
      themeMode={themeMode}
      theme={theme}
      onPress={() => openStackScreen("notifications")}
      icon={
        <View>
          <Bell color={theme.color.foreground} size={20} strokeWidth={2.2} />
          {unread > 0 ? (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: theme.color.foreground,
                  borderColor: theme.color.card,
                },
              ]}
            />
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
