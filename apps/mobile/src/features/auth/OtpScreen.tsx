import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { mobileAuthEmailVerifySchema } from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";

import type { RootStackParamList } from "../../navigation/types";
import { formatCountdown, type AppStrings } from "../../shared/lib/i18n";
import { requestEmailAuthCode, saveAuthSession, verifyEmailAuthCode, type AuthSession } from "../../shared/lib/auth";
import { OtpCodeField } from "./components/OtpCodeField";

type Props = NativeStackScreenProps<RootStackParamList, "Otp"> & {
  strings: AppStrings;
  theme: ThemeTokens;
  onAuthenticated: (session: AuthSession) => void;
};

export function OtpScreen({ navigation, route, strings, theme, onAuthenticated }: Props) {
  const { email, resendAfterSeconds } = route.params;
  const [code, setCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(resendAfterSeconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSecondsRemaining(resendAfterSeconds);
  }, [resendAfterSeconds]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  async function onVerify(): Promise<void> {
    const parsed = mobileAuthEmailVerifySchema.safeParse({ email, code });
    if (!parsed.success) {
      setErrorMessage(strings.codeInvalid);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const session = await verifyEmailAuthCode(parsed.data);
      await saveAuthSession(session);
      onAuthenticated(session);
    } catch {
      setErrorMessage(strings.emailAuthError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onResend(): Promise<void> {
    setIsResending(true);
    setErrorMessage(null);

    try {
      const challenge = await requestEmailAuthCode({ email });
      setSecondsRemaining(challenge.resendAfterSeconds);
    } catch {
      setErrorMessage(strings.emailAuthRequestFailed);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.root, { backgroundColor: theme.color.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.color.foreground }]}>← {strings.back}</Text>
        </Pressable>

        <Text style={[styles.title, { color: theme.color.foreground }]}>{strings.enterCodeTitle}</Text>
        <Text style={[styles.subtitle, { color: theme.color.mutedForeground }]}>
          {strings.codeSentTo} <Text style={[styles.email, { color: theme.color.foreground }]}>{email}</Text>
        </Text>

        <OtpCodeField value={code} onChangeText={setCode} accessibilityLabel={strings.otpAccessibilityLabel} theme={theme} />

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting || code.replace(/[^0-9]/g, "").length !== 6}
          onPress={() => void onVerify()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.color.primary },
            (isSubmitting || code.replace(/[^0-9]/g, "").length !== 6) && styles.primaryButtonDisabled,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: theme.color.primaryForeground }]}>
            {isSubmitting ? strings.loading : strings.verifyCode}
          </Text>
        </Pressable>

        <View style={styles.resendRow}>
          {secondsRemaining > 0 ? (
            <Text style={[styles.resendText, { color: theme.color.mutedForeground }]}>
              {strings.resendCodePrefix}
              {formatCountdown(secondsRemaining)}
            </Text>
          ) : (
            <Pressable accessibilityRole="button" disabled={isResending} onPress={() => void onResend()}>
              <Text style={[styles.resendAction, { color: theme.color.foreground }, isResending && styles.resendActionDisabled]}>
                {isResending ? strings.loading : strings.resendCodeNow}
              </Text>
            </Pressable>
          )}
        </View>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: theme.color.mutedForeground }]}>{errorMessage}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    overflow: "hidden",
  },
  content: {
    gap: 18,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  backButton: {
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_800ExtraBold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  email: {
    fontFamily: "Inter_700Bold",
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  resendRow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
  },
  resendText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  resendAction: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textDecorationLine: "underline",
  },
  resendActionDisabled: {
    opacity: 0.4,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
