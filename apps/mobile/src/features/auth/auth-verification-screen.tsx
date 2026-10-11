import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type MobileAuthChallenge } from "@workspace/api-client";
import { isDarkTheme, type ThemeTokens } from "@workspace/tokens";
import { formatCountdown, type AuthCopy } from "../../locales";
import { getErrorMessage } from "../../shared/lib/error-message";
import { styles } from "./auth-verification-screen.styles";
import { CodeCell, type HighlightState } from "./code-cell";

type Props = {
  theme: ThemeTokens;
  copy: AuthCopy;
  email: string;
  challenge: MobileAuthChallenge;
  isSubmitting?: boolean;
  onSubmitCode: (code: string) => void | Promise<void>;
  onResendCode: () => Promise<MobileAuthChallenge>;
};

const CODE_LENGTH = 4;
/** A wrong code stays red this long, then the cells clear for the next try. */
const ERROR_CLEAR_MS = 700;

export function AuthVerificationScreen({
  theme,
  copy,
  email,
  challenge,
  isSubmitting = false,
  onSubmitCode,
  onResendCode,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const resendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedCode = useRef<string | null>(null);

  const [code, setCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(
    challenge.resendAfterSeconds,
  );
  const [isResending, setIsResending] = useState(false);
  const [highlightState, setHighlightState] =
    useState<HighlightState>("normal");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedCode = useMemo(
    () => code.replace(/\D/g, "").slice(0, CODE_LENGTH),
    [code],
  );
  const canSubmit = normalizedCode.length === CODE_LENGTH;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setCode("");
    setSecondsRemaining(challenge.resendAfterSeconds);
    setHighlightState("normal");
    setErrorMessage(null);
    lastSubmittedCode.current = null;
    inputRef.current?.focus();
  }, [challenge]);

  useEffect(() => {
    async function triggerSubmit() {
      if (
        normalizedCode.length === CODE_LENGTH &&
        !isSubmitting &&
        normalizedCode !== lastSubmittedCode.current
      ) {
        lastSubmittedCode.current = normalizedCode;
        try {
          await onSubmitCode(normalizedCode);
          setHighlightState("success");
        } catch (error) {
          setHighlightState("error");
          setErrorMessage(
            getErrorMessage(error, copy.errors, copy.errors.verificationFailed),
          );
          // Keep the keyboard up: clear the wrong code and let the user type again.
          if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = setTimeout(() => {
            setCode("");
            lastSubmittedCode.current = null;
            inputRef.current?.focus();
          }, ERROR_CLEAR_MS);
        }
      }
    }
    void triggerSubmit();
  }, [normalizedCode, isSubmitting, onSubmitCode, copy.errors]);

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
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    },
    [],
  );

  function handleChangeText(nextValue: string): void {
    // While the code is checked the input stays focused (no keyboard flicker) but ignores typing.
    if (isSubmitting || highlightState === "success") return;
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    if (highlightState === "error") {
      setHighlightState("normal");
      setErrorMessage(null);
      lastSubmittedCode.current = null;
    }
    setCode(nextValue.replace(/\D/g, "").slice(0, CODE_LENGTH));
  }

  function handleSubmit(): void {
    if (!canSubmit) {
      return;
    }

    if (isSubmitting || normalizedCode === lastSubmittedCode.current) {
      return;
    }

    lastSubmittedCode.current = normalizedCode;
    void Promise.resolve(onSubmitCode(normalizedCode)).catch(() => undefined);
  }

  function handleResend(): void {
    if (resendTimeoutRef.current) {
      clearTimeout(resendTimeoutRef.current);
    }

    setIsResending(true);
    void onResendCode()
      .then((nextChallenge) => {
        setCode("");
        setErrorMessage(null);
        setHighlightState("normal");
        setSecondsRemaining(nextChallenge.resendAfterSeconds);
        inputRef.current?.focus();
      })
      .catch((error) => {
        Alert.alert(
          copy.errors.verificationFailedTitle,
          getErrorMessage(error, copy.errors, copy.verification.resendFailed),
        );
      })
      .finally(() => {
        resendTimeoutRef.current = setTimeout(() => {
          setIsResending(false);
        }, 450);
      });
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.root, { backgroundColor: theme.color.background }]}>
        <View
          pointerEvents="none"
          style={[
            styles.grid,
            {
              opacity: isDarkTheme(theme) ? 0.12 : 0.08,
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

        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 70,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={styles.centerStack}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
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
              <Text
                style={[
                  styles.subtitleStrong,
                  { color: theme.color.foreground },
                ]}
              >
                {email}
              </Text>
            </Text>

            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={styles.codeArea}
            >
              <View style={styles.codeRow}>
                {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                  const digit = normalizedCode[index] ?? "";
                  const isFocused =
                    normalizedCode.length === index &&
                    normalizedCode.length < CODE_LENGTH;
                  const isActive =
                    isFocused ||
                    (index === CODE_LENGTH - 1 &&
                      normalizedCode.length === CODE_LENGTH);

                  return (
                    <CodeCell
                      key={`code-cell-${index}`}
                      theme={theme}
                      value={digit}
                      isActive={isActive}
                      highlightState={highlightState}
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
              editable={highlightState !== "success"}
              onChangeText={handleChangeText}
              onSubmitEditing={handleSubmit}
              placeholder=""
              style={styles.hiddenInput}
              textContentType="oneTimeCode"
              value={code}
            />

            {errorMessage ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  styles.errorText,
                  {
                    color: theme.color.danger,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {errorMessage}
              </Text>
            ) : null}

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
                disabled={isResending || isSubmitting}
                onPress={handleResend}
                style={({ pressed }) => [
                  styles.resendButton,
                  {
                    borderColor: theme.color.border,
                    backgroundColor: theme.color.surface,
                  },
                  pressed && !isResending && !isSubmitting && styles.pressed,
                  (isResending || isSubmitting) && styles.resendButtonBusy,
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
                  {isResending
                    ? copy.verification.resendButtonBusy
                    : copy.verification.resendButton}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
