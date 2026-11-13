import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, Sparkles } from "lucide-react-native";

import type { Notification } from "@trefix/api-client";
import { type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { IconCircle } from "../../../shared/ui/list-card";

const keyOf = (value: string): string => value.replace(/[.-]/g, "_");

/** Sender shown when the notification has no title of its own. */
export function notificationTitle(
  item: Notification,
  copy: MainCopy["inbox"],
): string {
  if (item.title) return item.title;
  const senders = copy.senders as Record<string, string>;
  return senders[item.category] ?? copy.item.title;
}

export function notificationBody(
  item: Notification,
  copy: MainCopy["inbox"],
): string {
  if (item.body) return item.body;
  const types = copy.types as Record<string, string>;
  return types[keyOf(item.type)] ?? "";
}

type Props = {
  item: Notification;
  time: string;
  copy: MainCopy["inbox"];
  theme: ThemeTokens;
  onPress: () => void;
  onLongPress: () => void;
};

/** One inbox entry: sender, time, up to three lines of text, unread mark. */
export function NotificationRow({
  item,
  time,
  copy,
  theme,
  onPress,
  onLongPress,
}: Props) {
  const unread = !item.readAt;
  const title = notificationTitle(item, copy);
  const body = notificationBody(item, copy);
  const Icon = item.category === "coach" ? Sparkles : Bell;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, body, time].filter(Boolean).join(", ")}
      accessibilityHint={copy.item.open}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <IconCircle theme={theme}>
        <Icon color={theme.color.foreground} size={20} strokeWidth={2} />
      </IconCircle>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.time,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {time}
          </Text>
          {unread ? (
            <View
              style={[styles.dot, { backgroundColor: theme.color.foreground }]}
            />
          ) : null}
        </View>
        {body ? (
          <Text
            numberOfLines={3}
            style={[
              styles.body,
              {
                color: unread
                  ? theme.color.foreground
                  : theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {body}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.82,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    marginLeft: "auto",
    fontSize: 13,
    lineHeight: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
  },
});
