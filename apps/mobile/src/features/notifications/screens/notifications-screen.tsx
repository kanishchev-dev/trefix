import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Notification } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  formatDateLong,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { ListCard, SectionTitle } from "../../../shared/ui/list-card";
import { HeaderOptionsButton } from "../../main/components/header";
import { openStackScreen, useMainShell } from "../../main/main-routes";
import { ProfileSheet } from "../../profile/components/profile-sheet";
import {
  ProfileSection,
  ProfileSubScreen,
} from "../../profile/components/profile-sub-screen";
import { usePreferences } from "../../profile/hooks/use-preferences";
import { NotificationRow } from "../components/notification-row";
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotificationsInbox,
} from "../hooks/use-notifications";
import { groupByDay } from "../lib/inbox-groups";
import { openNotificationLink } from "../lib/open-notification-link";
import {
  getPushPermission,
  requestPushPermission,
  type PushPermission,
} from "../push";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

/** Push permission, re-checked when the user returns from the system settings. */
function usePushPermission(): [PushPermission | null, () => void] {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const check = useCallback(() => {
    void getPushPermission().then(setPermission);
  }, []);
  useEffect(() => {
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, [check]);
  return [permission, check];
}

/** The inbox: messages from Tref and Trefix, newest first, grouped by day. */
export function NotificationsScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const c = copy.inbox;
  const shell = useMainShell();
  const { preferences } = usePreferences();
  const inbox = useNotificationsInbox();
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();
  const [permission, recheck] = usePushPermission();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);

  const items = inbox.data?.pages.flatMap((page) => page.data) ?? [];
  const groups = groupByDay(items);
  const hasUnread = items.some((item) => !item.readAt);
  const timeFormat = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: preferences.timeFormat === "12h",
  });

  const open = (item: Notification) => {
    if (!item.readAt) markRead.mutate([item.id]);
    if (item.link) {
      openNotificationLink(item.link, { openTrefix: shell.openTrefix });
    }
  };

  const groupTitle = (key: string) =>
    key === "today"
      ? c.today
      : key === "yesterday"
        ? c.yesterday
        : formatDateLong(new Date(`${key}T12:00:00`), language);

  const enablePush = () => {
    if (permission === "denied") {
      void Linking.openSettings();
    } else {
      void requestPushPermission(language, c.channelName).then(recheck);
    }
  };

  return (
    <ProfileSubScreen
      title={c.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
      rightActionKey={String(hasUnread)}
      rightAction={
        <HeaderOptionsButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => setMenuVisible(true)}
        />
      }
    >
      {permission && permission !== "granted" ? (
        <View style={[styles.alert, { backgroundColor: theme.color.card }]}>
          <Text
            style={[
              styles.alertTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {c.push.offTitle}
          </Text>
          <Text
            style={[
              styles.alertBody,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {c.push.offBody}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={enablePush}
            style={({ pressed }) => [
              styles.alertButton,
              { backgroundColor: theme.color.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.alertButtonText,
                {
                  color: theme.color.primaryForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {permission === "denied" ? c.push.openSettings : c.push.enable}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {inbox.isLoading ? (
        <ActivityIndicator
          color={theme.color.mutedForeground}
          style={styles.loader}
        />
      ) : inbox.isError && items.length === 0 ? (
        <View style={styles.empty}>
          <Text
            style={[
              styles.emptyTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {c.error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void inbox.refetch()}
          >
            <Text
              style={[
                styles.link,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {c.retry}
            </Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text
            style={[
              styles.emptyTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {c.empty.title}
          </Text>
          <Text
            style={[
              styles.emptyBody,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {c.empty.body}
          </Text>
        </View>
      ) : (
        groups.map((group) => (
          <ProfileSection key={group.key}>
            <SectionTitle text={groupTitle(group.key)} theme={theme} />
            <ListCard theme={theme}>
              {group.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  time={timeFormat.format(new Date(item.createdAt))}
                  copy={c}
                  theme={theme}
                  onPress={() => open(item)}
                  onLongPress={() => setSelected(item)}
                />
              ))}
            </ListCard>
          </ProfileSection>
        ))
      )}

      {inbox.hasNextPage ? (
        <Pressable
          accessibilityRole="button"
          disabled={inbox.isFetchingNextPage}
          onPress={() => void inbox.fetchNextPage()}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          {inbox.isFetchingNextPage ? (
            <ActivityIndicator color={theme.color.mutedForeground} />
          ) : (
            <Text
              style={[
                styles.link,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {c.loadMore}
            </Text>
          )}
        </Pressable>
      ) : null}

      <ProfileSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title={c.menu.title}
        actions={[
          ...(hasUnread
            ? [
                {
                  key: "read-all",
                  label: c.menu.readAll,
                  onPress: () => markAllRead.mutateAsync(),
                },
              ]
            : []),
          {
            key: "settings",
            label: c.menu.settings,
            onPress: () => openStackScreen("notificationsSettings"),
          },
        ]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileSheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? c.item.title : ""}
        actions={
          selected
            ? [
                ...(selected.link
                  ? [
                      {
                        key: "open",
                        label: c.item.open,
                        onPress: () => open(selected),
                      },
                    ]
                  : []),
                {
                  key: "delete",
                  label: c.item.delete,
                  destructive: true,
                  onPress: () => remove.mutateAsync(selected.id),
                },
              ]
            : []
        }
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  alert: {
    borderRadius: 24,
    padding: 16,
    gap: 8,
    alignItems: "flex-start",
  },
  alertTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  alertBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  alertButton: {
    marginTop: 4,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  alertButtonText: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
  loader: {
    marginTop: 48,
  },
  empty: {
    marginTop: 64,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
  },
  link: {
    fontSize: 15,
    lineHeight: 20,
  },
  more: {
    alignItems: "center",
    paddingVertical: 12,
  },
});
