import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import {
  InlineError,
  SheetActionsColumn,
} from "../../plans/components/plans-ui";
import { profileErrorMessage } from "../../profile/lib/profile-format";
import { useGiveHealthConsent } from "../hooks";

type Props = {
  visible: boolean;
  storeName: string;
  /** `accepted` — the consent is recorded and the connection may continue. */
  onClose: (accepted: boolean) => void;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://trefix.run/privacy";

/** H2 — consent to process health data (special category of personal data). Shown once per text version. */
export function HealthConsentSheet({
  visible,
  storeName,
  onClose,
  copy,
  theme,
  themeMode,
}: Props) {
  const c = copy.profile.integrations.health.consent;
  const give = useGiveHealthConsent();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accepted = useRef(false);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setChecked(false);
      setError(null);
      accepted.current = false;
    }
  }, [visible]);

  const submit = async () => {
    setError(null);
    try {
      await give.mutateAsync();
      accepted.current = true;
      setOpen(false);
    } catch (giveError) {
      setError(profileErrorMessage(giveError, copy));
    }
  };

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };

  return (
    <BottomSheet
      title={c.title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose(accepted.current);
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
          <Text style={[styles.body, muted]}>
            {fillTemplate(c.body, { store: storeName })}
          </Text>
          <Text
            accessibilityRole="link"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
            style={[
              styles.link,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {c.policy}
          </Text>
        </SheetBlock>

        <SheetBlock theme={theme}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={c.checkbox}
            onPress={() => setChecked((value) => !value)}
            style={({ pressed }) => [
              styles.checkRow,
              { backgroundColor: theme.color.control },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.box,
                {
                  borderColor: checked
                    ? theme.color.foreground
                    : theme.color.mutedForeground,
                  backgroundColor: checked
                    ? theme.color.foreground
                    : "transparent",
                },
              ]}
            >
              {checked ? (
                <Check
                  color={theme.color.background}
                  size={14}
                  strokeWidth={3}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.checkText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {c.checkbox}
            </Text>
          </Pressable>
        </SheetBlock>

        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}

        <SheetBlock theme={theme}>
          <SheetActionsColumn>
            <SheetButton
              label={c.continue}
              onPress={() => void submit()}
              disabled={!checked}
              pending={give.isPending}
              theme={theme}
              themeMode={themeMode}
            />
            <SheetButton
              label={c.cancel}
              variant="secondary"
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
    flexGrow: 0,
  },
  content: {
    gap: 12,
    paddingBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.8,
  },
});
