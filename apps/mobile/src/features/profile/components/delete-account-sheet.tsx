import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { trackEvent } from "../../../lib/analytics";
import { deleteAccount } from "../../../lib/auth-api";
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

type Props = {
  visible: boolean;
  /** `deleted` — the account is gone and the session must end. */
  onClose: (deleted: boolean) => void;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/** Permanent account deletion, required to be reachable in-app by the App Store. */
export function DeleteAccountSheet({
  visible,
  onClose,
  copy,
  theme,
  themeMode,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleted = useRef(false);
  const sheetCopy = copy.profile.deleteAccount;

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setError(null);
      deleted.current = false;
    }
  }, [visible]);

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      trackEvent("account_delete_confirmed");
      await deleteAccount();
      deleted.current = true;
      setOpen(false);
    } catch (deleteError) {
      setError(profileErrorMessage(deleteError, copy));
    } finally {
      setPending(false);
    }
  };

  return (
    <BottomSheet
      title={sheetCopy.title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose(deleted.current);
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SheetBlock theme={theme}>
          <Text
            style={[
              styles.body,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {sheetCopy.body}
          </Text>
        </SheetBlock>
        <SheetBlock theme={theme}>
          <View style={[styles.list, { backgroundColor: theme.color.control }]}>
            {sheetCopy.items.map((item) => (
              <View key={item} style={styles.item}>
                <X color={theme.color.danger} size={16} strokeWidth={2.4} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.itemText,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </SheetBlock>
        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}
        <SheetBlock theme={theme}>
          <SheetActionsColumn>
            <SheetButton
              label={sheetCopy.confirm}
              variant="destructive"
              pending={pending}
              onPress={() => void confirm()}
              theme={theme}
              themeMode={themeMode}
            />
            <SheetButton
              label={sheetCopy.cancel}
              variant="secondary"
              disabled={pending}
              onPress={() => setOpen(false)}
              theme={theme}
              themeMode={themeMode}
            />
          </SheetActionsColumn>
        </SheetBlock>
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
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  list: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
});
