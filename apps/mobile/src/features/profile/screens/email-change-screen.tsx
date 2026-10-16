import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { useToast } from "../../../shared/ui/toast";
import { CodeCell } from "../../auth/code-cell";
import { styles as codeStyles } from "../../auth/auth-verification-screen.styles";
import { useProfile } from "../../main/hooks/use-profile";
import { InlineError } from "../../plans/components/plans-ui";
import { FormField, FormInput } from "../components/profile-form";
import { Footnote, ProfileSubScreen } from "../components/profile-sub-screen";
import {
  useConfirmEmailChange,
  useRequestEmailChange,
} from "../hooks/use-account";
import { profileErrorMessage } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

const CODE_LENGTH = 4;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** New email in two steps: the address, then the code sent to it. */
export function EmailChangeScreen({ theme, themeMode, copy, onBack }: Props) {
  const { data: user } = useProfile();
  const requestChange = useRequestEmailChange();
  const confirmChange = useConfirmEmailChange();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const m = copy.profile.emailChange;

  useEffect(() => {
    if (!sentTo) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sentTo]);

  const send = async (address: string) => {
    setError(null);
    if (!EMAIL_PATTERN.test(address.trim())) {
      setError(m.invalidEmail);
      return;
    }
    try {
      const challenge = await requestChange.mutateAsync(address.trim());
      setSentTo(challenge.email);
      setCode("");
      setResendAt(Date.now() + challenge.resendAfterSeconds * 1000);
      setTimeout(() => inputRef.current?.focus(), 300);
    } catch (sendError) {
      setError(profileErrorMessage(sendError, copy));
    }
  };

  const confirm = async (value: string) => {
    setError(null);
    try {
      await confirmChange.mutateAsync(value);
      showToast(m.changed);
      onBack();
    } catch (confirmError) {
      setError(profileErrorMessage(confirmError, copy));
      setCode("");
    }
  };

  const changeCode = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void confirm(digits);
  };

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const timer = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const heading = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };

  return (
    <ProfileSubScreen
      title={m.title}
      onBack={sentTo ? () => setSentTo(null) : onBack}
      theme={theme}
      themeMode={themeMode}
      footer={
        <SheetButton
          label={sentTo ? m.confirm : m.getCode}
          disabled={
            sentTo ? code.length < CODE_LENGTH : email.trim().length === 0
          }
          pending={requestChange.isPending || confirmChange.isPending}
          onPress={() => void (sentTo ? confirm(code) : send(email))}
          theme={theme}
          themeMode={themeMode}
        />
      }
    >
      {sentTo ? (
        <View style={styles.step}>
          <View style={styles.lead}>
            <Text style={[styles.title, heading]}>{m.codeTitle}</Text>
            <Text style={[styles.paragraph, muted]}>
              {fillTemplate(m.sentTo, { email: sentTo })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="none"
            onPress={() => inputRef.current?.focus()}
          >
            <View style={codeStyles.codeRow}>
              {Array.from({ length: CODE_LENGTH }).map((_, index) => (
                <CodeCell
                  key={index}
                  theme={theme}
                  value={code[index] ?? ""}
                  isActive={
                    code.length === index ||
                    (index === CODE_LENGTH - 1 && code.length === CODE_LENGTH)
                  }
                  isDisabled={confirmChange.isPending}
                  highlightState={error ? "error" : "normal"}
                />
              ))}
            </View>
          </Pressable>
          <TextInput
            ref={inputRef}
            accessibilityLabel={m.codeTitle}
            autoComplete="one-time-code"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            value={code}
            onChangeText={changeCode}
            style={codeStyles.hiddenInput}
          />
          {secondsLeft > 0 ? (
            <Text style={[styles.resend, muted]}>
              {fillTemplate(m.resendIn, { time: timer })}
            </Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => void send(sentTo)}
            >
              <Text style={[styles.resend, heading]}>{m.resend}</Text>
            </Pressable>
          )}
          {error ? <InlineError message={error} theme={theme} /> : null}
        </View>
      ) : (
        <View style={styles.step}>
          <View style={styles.lead}>
            <Text style={[styles.title, heading]}>{m.newTitle}</Text>
            {user?.email ? (
              <Text style={[styles.paragraph, muted]}>
                {fillTemplate(m.current, { email: user.email })}
              </Text>
            ) : null}
          </View>
          <FormField theme={theme} label={m.label}>
            <FormInput
              theme={theme}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={() => void send(email)}
              accessibilityLabel={m.label}
            />
          </FormField>
          <Footnote text={m.hint} theme={theme} />
          {error ? <InlineError message={error} theme={theme} /> : null}
        </View>
      )}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  step: {
    gap: 20,
  },
  lead: {
    gap: 6,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
  },
  resend: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
});
