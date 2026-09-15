import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { mobileAuthEmailRequestSchema, type MobileAuthSocialProvider } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import type { RootStackParamList } from "../../navigation/types";
import type { AppStrings } from "../../shared/lib/i18n";
import { requestEmailAuthCode, startMobileSocialAuth } from "../../shared/lib/auth";
import { ExpoGlassSurface, GlassContainer } from "./components/ExpoGlassSurface";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome"> & {
  strings: AppStrings;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

export function WelcomeScreen({ navigation, strings, theme, themeMode }: Props) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const logoTranslateY = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(18)).current;
  const heroIconSource =
    themeMode === "dark"
      ? require("../../../assets/trefix-logo-light.png")
      : require("../../../assets/trefix-logo-dark.png");
  const googleIconSource =
    themeMode === "dark"
      ? require("../../../assets/google-icon-dark.png")
      : require("../../../assets/google-icon-light.png");
  const normalizedEmail = email.trim();
  const isValidEmail = mobileAuthEmailRequestSchema.safeParse({ email: normalizedEmail }).success;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoTranslateY, {
          toValue: -350,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 0.6,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 800);

    return () => clearTimeout(timer);
  }, [contentOpacity, contentTranslateY, logoScale, logoTranslateY]);

  async function onContinue(): Promise<void> {
    const parsed = mobileAuthEmailRequestSchema.safeParse({ email: normalizedEmail });
    if (!parsed.success) {
      setErrorMessage(strings.invalidEmail);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const challenge = await requestEmailAuthCode(parsed.data);
      navigation.navigate("Otp", {
        email: challenge.email,
        expiresInSeconds: challenge.expiresInSeconds,
        resendAfterSeconds: challenge.resendAfterSeconds,
      });
    } catch {
      setErrorMessage(strings.emailAuthRequestFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSocialAuth(provider: MobileAuthSocialProvider): Promise<void> {
    setErrorMessage(null);
    setIsSocialLoading(true);

    try {
      await startMobileSocialAuth(provider);
    } catch {
      setErrorMessage(strings.socialAuthFailed);
    } finally {
      setIsSocialLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <View style={styles.hero}>
        <Animated.View style={{ transform: [{ translateY: logoTranslateY }, { scale: logoScale }] }}>
          <Image source={heroIconSource} style={styles.heroLogo} resizeMode="contain" />
        </Animated.View>
      </View>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        <GlassContainer style={styles.contentInner} spacing={20}>
          <Text style={[styles.title, { color: theme.color.foreground }]}>{strings.welcomeTitle}</Text>
          <Text style={[styles.subtitle, { color: theme.color.mutedForeground }]}>{strings.welcomeSubtitle}</Text>

          <View style={styles.socialButtons}>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting || isSocialLoading}
              onPress={() => void onSocialAuth("google")}
              style={[styles.socialPressable, (isSubmitting || isSocialLoading) && styles.socialButtonDisabled]}
            >
              {({ pressed }) => (
                <ExpoGlassSurface
                  style={[
                    styles.socialButton,
                    styles.socialButtonGlass,
                    {
                      backgroundColor: theme.color.glassBackground,
                      borderColor: theme.color.glassBorder,
                    },
                    pressed && styles.socialButtonPressed,
                  ]}
                  glassEffectStyle="regular"
                  colorScheme={themeMode}
                  tintColor={theme.color.glassTint}
                  interactive
                >
                  <Image source={googleIconSource} style={styles.providerIcon} resizeMode="contain" />
                  <Text style={[styles.socialButtonText, { color: theme.color.foreground }]}>{strings.continueWithGoogle}</Text>
                </ExpoGlassSurface>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting || isSocialLoading}
              onPress={() => void onSocialAuth("apple")}
              style={[styles.socialPressable, (isSubmitting || isSocialLoading) && styles.socialButtonDisabled]}
            >
              {({ pressed }) => (
                <ExpoGlassSurface
                  style={[
                    styles.socialButton,
                    styles.appleButton,
                    styles.socialButtonGlass,
                    {
                      backgroundColor: theme.color.glassBackground,
                      borderColor: theme.color.glassBorder,
                    },
                    pressed && styles.socialButtonPressed,
                  ]}
                  glassEffectStyle="regular"
                  colorScheme={themeMode}
                  tintColor={theme.color.glassTint}
                  interactive
                >
                  <Text style={[styles.appleGlyph, { color: theme.color.foreground }]}></Text>
                  <Text style={[styles.socialButtonText, { color: theme.color.foreground }]}>
                    {strings.continueWithApple}
                  </Text>
                </ExpoGlassSurface>
              )}
            </Pressable>
          </View>

          <ExpoGlassSurface
            style={[
              styles.emailShell,
              {
                backgroundColor: theme.color.glassBackground,
                borderColor: theme.color.glassBorder,
              },
            ]}
            glassEffectStyle="regular"
            colorScheme={themeMode}
            tintColor={theme.color.glassTint}
          >
            <TextInput
              accessibilityLabel={strings.emailLabel}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={(text) => {
                setEmail(text);
                setErrorMessage(null);
              }}
              placeholder={strings.emailPlaceholder}
              placeholderTextColor={theme.color.mutedForeground}
              returnKeyType="send"
              style={[styles.emailInput, { color: theme.color.foreground }]}
              textAlign="center"
              value={email}
            />

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting || !isValidEmail}
              onPress={() => void onContinue()}
              style={[styles.emailAction, (isSubmitting || !isValidEmail) && styles.emailActionDisabled]}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.emailActionInner,
                    {
                      backgroundColor: themeMode === "dark" ? "rgba(248,250,252,0.96)" : "rgba(15,23,42,0.94)",
                    },
                    pressed && styles.emailActionPressed,
                  ]}
                >
                  <Text style={[styles.emailActionText, { color: themeMode === "dark" ? "#020617" : "#ffffff" }]}>→</Text>
                </View>
              )}
            </Pressable>
          </ExpoGlassSurface>

          {errorMessage ? <Text style={[styles.errorText, { color: themeMode === "dark" ? "#fca5a5" : "#b91c1c" }]}>{errorMessage}</Text> : null}

          <Text style={[styles.legalText, { color: theme.color.mutedForeground }]}>
            {strings.termsPrefix}
            <Text style={[styles.linkText, { color: theme.color.foreground }]} onPress={() => undefined}>
              {strings.terms}
            </Text>
            {" "}
            <Text style={[styles.linkText, { color: theme.color.foreground }]} onPress={() => undefined}>
              {strings.privacy}
            </Text>
            {strings.termsSuffix}
          </Text>
        </GlassContainer>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  hero: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    marginTop: -43,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLogo: {
    width: 260,
    height: 86,
  },
  content: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  contentInner: {
    width: "100%",
    maxWidth: 420,
    gap: 18,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "Inter_800ExtraBold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  socialButtons: {
    gap: 12,
  },
  socialPressable: {
    width: "100%",
  },
  socialButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
  },
  socialButtonGlass: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  appleButton: {
    minHeight: 54,
  },
  socialButtonDisabled: {
    opacity: 0.55,
  },
  socialButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  socialButtonText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  appleGlyph: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
    marginTop: -1,
  },
  providerIcon: {
    width: 20,
    height: 20,
  },
  emailShell: {
    minHeight: 56,
    borderRadius: 18,
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  emailInput: {
    minHeight: 56,
    paddingHorizontal: 56,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  emailAction: {
    position: "absolute",
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emailActionInner: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emailActionDisabled: {
    opacity: 0.35,
  },
  emailActionPressed: {
    transform: [{ scale: 0.96 }],
  },
  emailActionText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  errorText: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  linkText: {
    fontFamily: "Inter_700Bold",
    textDecorationLine: "underline",
  },
});
