import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import {
  InlineError,
  SheetActionsColumn,
} from "../../plans/components/plans-ui";
import { profileErrorMessage } from "../lib/profile-format";

type Work = () => Promise<unknown> | unknown;

export type SheetAction = {
  key: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Value on the right, e.g. mileage of an imported pair. */
  value?: string;
  destructive?: boolean;
  /** Radio-style list: the chosen option gets a check mark. */
  selected?: boolean;
  onPress: Work;
};

export type SheetButtonSpec = {
  label: string;
  variant?: "primary" | "secondary" | "destructive";
  onPress?: Work;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Round icon above the title. */
  badge?: ReactNode;
  body?: string;
  /** "Key — value" lines (identity, device details). */
  info?: Array<{ label: string; value: string }>;
  /** Plain list of items (what the export contains). */
  items?: string[];
  /** Rows that act and close the sheet (photo source, gear actions). */
  actions?: SheetAction[];
  /** Big tiles for picking what to add. */
  tiles?: SheetAction[];
  /** Buttons at the bottom; a button without `onPress` just closes the sheet. */
  buttons?: SheetButtonSpec[];
  children?: ReactNode;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/**
 * One sheet for the profile's confirmations and action lists: runs the chosen
 * action, keeps the sheet open with an inline error if it fails, closes on success.
 */
export function ProfileSheet({
  visible,
  onClose,
  title,
  badge,
  body,
  info,
  items,
  actions,
  tiles,
  buttons,
  children,
  copy,
  theme,
  themeMode,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setError(null);
      setPending(null);
    }
  }, [visible]);

  const run = async (key: string, work?: Work) => {
    if (pending) return;
    if (!work) {
      setOpen(false);
      return;
    }
    setPending(key);
    setError(null);
    try {
      await work();
      setOpen(false);
    } catch (runError) {
      setError(profileErrorMessage(runError, copy));
    } finally {
      setPending(null);
    }
  };

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const strong = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };

  return (
    <BottomSheet
      title={title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {badge ? (
          <SheetBlock theme={theme}>
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.color.iconSurface },
              ]}
            >
              {badge}
            </View>
          </SheetBlock>
        ) : null}
        {info && info.length > 0 ? (
          <SheetBlock theme={theme}>
            <View
              style={[styles.list, { backgroundColor: theme.color.screen }]}
            >
              {info.map((line, index) => (
                <View
                  key={line.label}
                  style={[
                    styles.row,
                    index > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: theme.color.sheet,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.rowText, styles.flex, muted]}
                  >
                    {line.label}
                  </Text>
                  <Text numberOfLines={1} style={[styles.rowText, strong]}>
                    {line.value}
                  </Text>
                </View>
              ))}
            </View>
          </SheetBlock>
        ) : null}
        {body ? (
          <SheetBlock theme={theme}>
            <Text style={[styles.body, muted]}>{body}</Text>
          </SheetBlock>
        ) : null}
        {items && items.length > 0 ? (
          <SheetBlock theme={theme}>
            <View
              style={[styles.list, { backgroundColor: theme.color.screen }]}
            >
              {items.map((item, index) => (
                <View
                  key={item}
                  style={[
                    styles.row,
                    index > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: theme.color.sheet,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.rowText, strong]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </SheetBlock>
        ) : null}
        {tiles && tiles.length > 0 ? (
          <SheetBlock theme={theme}>
            <View style={styles.tiles}>
              {tiles.map((tile) => (
                <Pressable
                  key={tile.key}
                  accessibilityRole="button"
                  disabled={Boolean(pending)}
                  onPress={() => void run(tile.key, tile.onPress)}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: theme.color.screen },
                    pressed && styles.pressed,
                  ]}
                >
                  {tile.icon ? (
                    <View
                      style={[
                        styles.tileIcon,
                        { backgroundColor: theme.color.card },
                      ]}
                    >
                      {tile.icon}
                    </View>
                  ) : null}
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={[styles.rowText, strong]}>
                      {tile.label}
                    </Text>
                    {tile.description ? (
                      <Text
                        numberOfLines={1}
                        style={[styles.description, muted]}
                      >
                        {tile.description}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </SheetBlock>
        ) : null}
        {actions && actions.length > 0 ? (
          <SheetBlock theme={theme}>
            <View
              style={[styles.list, { backgroundColor: theme.color.screen }]}
            >
              {actions.map((action, index) => (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  disabled={Boolean(pending)}
                  onPress={() => void run(action.key, action.onPress)}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: theme.color.sheet,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  {action.icon}
                  <View style={styles.flex}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.rowText,
                        strong,
                        action.destructive && { color: theme.color.danger },
                      ]}
                    >
                      {action.label}
                    </Text>
                    {action.description ? (
                      <Text
                        numberOfLines={1}
                        style={[styles.description, muted]}
                      >
                        {action.description}
                      </Text>
                    ) : null}
                  </View>
                  {action.value ? (
                    <Text numberOfLines={1} style={[styles.rowText, muted]}>
                      {action.value}
                    </Text>
                  ) : null}
                  {action.selected ? (
                    <Check
                      color={theme.color.foreground}
                      size={18}
                      strokeWidth={2.4}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </SheetBlock>
        ) : null}
        {children}
        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}
        {buttons && buttons.length > 0 ? (
          <SheetBlock theme={theme}>
            <SheetActionsColumn>
              {buttons.map((button) => (
                <SheetButton
                  key={button.label}
                  label={button.label}
                  variant={button.variant ?? "primary"}
                  pending={pending === button.label}
                  disabled={Boolean(pending) && pending !== button.label}
                  onPress={() => void run(button.label, button.onPress)}
                  theme={theme}
                  themeMode={themeMode}
                />
              ))}
            </SheetActionsColumn>
          </SheetBlock>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: "100%",
  },
  content: {
    gap: 16,
    paddingTop: 72,
    paddingBottom: 32,
  },
  badge: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  list: {
    borderRadius: 20,
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: {
    fontSize: 15,
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tiles: {
    gap: 8,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 24,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.82,
  },
});
