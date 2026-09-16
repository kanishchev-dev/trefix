import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeTokens } from "@workspace/tokens";
import { formatCountdown, type AuthCopy } from "../../locales";

type Props = {
  theme: ThemeTokens;
  copy: AuthCopy;
  email: string;
  onSubmitCode: (code: string) => void;
};

const CODE_LENGTH = 4;
const RESEND_AFTER_SECONDS = 59;

export function AuthVerificationScreen({ theme, copy, email, onSubmitCode }: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const resendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [code, setCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(RESEND_AFTER_SECONDS);
  const [isResending, setIsResending] = useState(false);

  const normalizedCode = useMemo(() => code.replace(/\D/g, "").slice(0, CODE_LENGTH), [code]);
  const canSubmit = normalizedCode.length === CODE_LENGTH;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (code === normalizedCode) {
      return;
    }

    setCode(normalizedCode);
  }, [code, normalizedCode]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (resendTimeoutRef.current) {
        clearTimeout(resendTimeoutRef.current);
      }
    },
    [],
  );

  function handleChangeText(nextValue: string): void {
    setCode(nextValue.replace(/\D/g, "").slice(0, CODE_LENGTH));
  }

  function handleSubmit(): void {
    if (!canSubmit) {
      return;
    }

    onSubmitCode(normalizedCode);
  }

  function handleResend(): void {
    if (resendTimeoutRef.current) {
      clearTimeout(resendTimeoutRef.current);
    }

    setIsResending(true);
    setCode("");
    setSecondsRemaining(RESEND_AFTER_SECONDS);
    inputRef.current?.focus();

    resendTimeoutRef.current = setTimeout(() => {
      setIsResending(false);
    }, 450);
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.root, { backgroundColor: theme.color.background }]}>
        <View
          pointerEvents="none"
          style={[
            styles.grid,
            {
              opacity: theme.color.background === "#09090b" ? 0.12 : 0.08,
            },
          ]}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <View
              key={`grid-line-${index}`}
              style={[
                styles.gridLine,
                {
                  backgroundColor: theme.color.border,
                  opacity: index % 2 === 0 ? 0.7 : 0.45,
                },
              ]}
            />
          ))}
        </View>

        <View style={[styles.content, { paddingTop: 32, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.centerStack}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.extrabold,
                },
              ]}
            >
              {copy.verification.title}
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {copy.verification.subtitlePrefix}{" "}
              <Text style={[styles.subtitleStrong, { color: theme.color.foreground }]}>{email}</Text>
            </Text>

            <Pressable onPress={() => inputRef.current?.focus()} style={styles.codeArea}>
              <View style={styles.codeRow}>
                {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                  const digit = normalizedCode[index] ?? "";
                  const isFocused = normalizedCode.length === index && normalizedCode.length < CODE_LENGTH;
                  const isActive = isFocused || (index === CODE_LENGTH - 1 && normalizedCode.length === CODE_LENGTH);

                  return (
                    <CodeCell
                      key={`code-cell-${index}`}
                      theme={theme}
                      value={digit}
                      isActive={isActive}
                    />
                  );
                })}
              </View>
            </Pressable>

            <TextInput
              ref={inputRef}
              accessibilityLabel={copy.verification.codeAccessibilityLabel}
              autoComplete="one-time-code"
              autoCorrect={false}
              keyboardType="number-pad"
              onChangeText={handleChangeText}
              onSubmitEditing={handleSubmit}
              placeholder=""
              style={styles.hiddenInput}
              textContentType="oneTimeCode"
              value={code}
            />

            {secondsRemaining > 0 ? (
              <View style={styles.resendBlock}>
                <Text
                  style={[
                    styles.resendCaption,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {copy.verification.resendCountdownPrefix}
                </Text>
                <Text
                  style={[
                    styles.resendTimer,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {formatCountdown(secondsRemaining)}
                </Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.verification.resendButton}
                disabled={isResending}
                onPress={handleResend}
                style={({ pressed }) => [
                  styles.resendButton,
                  {
                    borderColor: theme.color.border,
                    backgroundColor: theme.color.surface,
                  },
                  pressed && !isResending && styles.pressed,
                  isResending && styles.resendButtonBusy,
                ]}
              >
                <Text
                  style={[
                    styles.resendLabel,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {isResending ? copy.verification.resendButtonBusy : copy.verification.resendButton}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

type CodeCellProps = {
  theme: ThemeTokens;
  value: string;
  isActive: boolean;
};

function CodeCell({ theme, value, isActive }: CodeCellProps) {
  return (
    <GlassView
      glassEffectStyle="regular"
      tintColor={theme.color.glassTint}
      style={[
        styles.codeCell,
        {
          borderColor: isActive ? theme.color.foreground : theme.color.glassBorder,
          backgroundColor: theme.color.glassBackground,
        },
      ]}
    >
      {value ? (
        <Text
          style={[
            styles.codeDigit,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.bold,
            },
          ]}
        >
          {value}
        </Text>
      ) : isActive ? (
        <View
          style={[
            styles.cursor,
            {
              backgroundColor: theme.color.foreground,
            },
          ]}
        />
      ) : null}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  orbTop: {
    position: "absolute",
    top: -72,
    right: -36,
    width: 220,
    height: 220,
    borderRadius: 220,
  },
  orbBottom: {
    position: "absolute",
    left: -72,
    bottom: -80,
    width: 280,
    height: 280,
    borderRadius: 280,
  },
  grid: {
    position: "absolute",
    left: -12,
    right: -12,
    bottom: 0,
    height: 160,
    justifyContent: "flex-end",
    alignItems: "stretch",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  gridLine: {
    height: 1,
    borderRadius: 999,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centerStack: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  subtitleStrong: {
    fontWeight: "700",
  },
  codeArea: {
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    width: "100%",
  },
  codeCell: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  codeDigit: {
    fontSize: 26,
    lineHeight: 30,
    includeFontPadding: false,
  },
  cursor: {
    width: 2,
    height: 26,
    borderRadius: 999,
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendBlock: {
    alignItems: "center",
    gap: 4,
    paddingTop: 8,
  },
  resendCaption: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  resendTimer: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  resendButton: {
    width: "100%",
    height: 56,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  resendButtonBusy: {
    opacity: 0.72,
  },
  resendLabel: {
    fontSize: 16,
    lineHeight: 20,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.88,
  },
});
