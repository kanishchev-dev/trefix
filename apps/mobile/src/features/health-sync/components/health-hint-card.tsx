import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { IconCircle } from "../../../shared/ui/list-card";

type Props = {
  title: string;
  body: string;
  icon: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionPending?: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/** Explanation with an optional action: missing access, no history, Health Connect not installed. */
export function HealthHintCard({ title, body, icon, actionLabel, onAction, actionPending, theme, themeMode }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: theme.color.card }]}>
      <View style={styles.header}>
        <IconCircle theme={theme} size={36}>
          {icon}
        </IconCircle>
        <Text style={[styles.title, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.body, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <SheetButton
          label={actionLabel}
          variant="secondary"
          onPress={onAction}
          pending={actionPending}
          theme={theme}
          themeMode={themeMode}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
  },
});
