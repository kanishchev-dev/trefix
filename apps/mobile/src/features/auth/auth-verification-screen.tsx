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
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { type MobileAuthChallenge } from "@trefix/api-client";
import { isDarkTheme, type ThemeTokens } from "@trefix/tokens";
import { formatCountdown, type AuthCopy } from "../../locales";
import { getErrorMessage } from "../../shared/lib/error-message";
import { useToast } from "../../shared/ui/toast";
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
/** Step between cells as a wrong code turns red, right to left. */
const ERROR_STAGGER_MS = 30;
/** Passcode-style shake of the row on a wrong code: offsets in px, 40 ms per step. */
const SHAKE_OFFSETS = [-8, 8, -6, 6, -3, 0];
const SHAKE_STEP_MS = 40;

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
  const lastSubmittedCode = useRef<string | null>(null);

  const [code, setCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(
    challenge.resendAfterSeconds,
  );
  const [isResending, setIsResending] = useState(false);
  const [highlightState, setHighlightState] =
    useState<HighlightState>("normal");
  const { showToast } = useToast();
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

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
          shakeX.value = withSequence(
            ...SHAKE_OFFSETS.map((offset) =>
              withTiming(offset, { duration: SHAKE_STEP_MS }),
            ),
          );
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          );
          showToast(
            getErrorMessage(error, copy.errors, copy.errors.verificationFailed),
          );
          // The wrong code stays in the cells: often it's one digit off, so the
          // user fixes it instead of retyping everything. Editing clears the error.
        }
      }
    }
    void triggerSubmit();
  }, [
    normalizedCode,
    isSubmitting,
    onSubmitCode,
    copy.errors,
    showToast,
    shakeX,
  ]);

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
    // While the code is checked the input stays focused (no keyboard flicker) but ignores typing.
    if (isSubmitting || highlightState === "success") return;
    if (highlightState === "error") {
      setHighlightState("normal");
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
              <Animated.View style={[styles.codeRow, shakeStyle]}>
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
                      isDisabled={isSubmitting}
                      highlightState={highlightState}
                      errorDelayMs={
                        (CODE_LENGTH - 1 - index) * ERROR_STAGGER_MS
                      }
                    />
                  );
                })}
              </Animated.View>
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
              <Text
                style={[
                  styles.resendPrompt,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {copy.verification.resendPrompt}{" "}
                {isResending || isSubmitting ? (
                  <Text
                    style={{
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    }}
                  >
                    {copy.verification.resendBusy}
                  </Text>
                ) : (
                  <Text
                    accessibilityRole="link"
                    onPress={handleResend}
                    style={{
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    }}
                  >
                    {copy.verification.resendLink}
                  </Text>
                )}
                {copy.verification.resendSuffix}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
