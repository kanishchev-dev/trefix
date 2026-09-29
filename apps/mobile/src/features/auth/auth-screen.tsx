import { useEffect, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Keyboard,
  LayoutAnimation,
  UIManager,
  Linking,
  Text,
  TouchableWithoutFeedback,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { AuthSocialButtons } from "./components/auth-social-buttons";
import { AuthDivider } from "./components/auth-divider";
import { AuthEmailField } from "./components/auth-email-field";
import { type AuthCopy } from "../../locales";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: AuthCopy;
  email: string;
  isEmailSubmitting?: boolean;
  isSocialSubmitting?: boolean;
  isSocialDisabled?: boolean;
  showGoogleButton?: boolean;
  showAppleButton?: boolean;
  onEmailChange: (value: string) => void;
  onSubmitEmail: (value: string) => void | Promise<void>;
  onGooglePress?: () => void | Promise<void>;
  onApplePress?: () => void | Promise<void>;
};

export function AuthScreen({
  theme,
  themeMode,
  copy,
  email,
  isEmailSubmitting = false,
  isSocialSubmitting = false,
  isSocialDisabled = false,
  showGoogleButton = true,
  showAppleButton = false,
  onEmailChange,
  onSubmitEmail,
  onGooglePress,
  onApplePress,
}: Props) {
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const isFocused = useIsFocused();

  const hasSocialAuth = showGoogleButton || showAppleButton;

  const videoPlayer = useVideoPlayer(
    require("../../../assets/auth-background.mov"),
    (player) => {
      player.loop = true;
      player.muted = true;
    },
  );

  const logoSource =
    themeMode === "dark"
      ? require("../../../assets/trefix-logo-light.png")
      : require("../../../assets/trefix-logo-dark.png");

  useEffect(() => {
    if (isFocused) {
      void videoPlayer.play();
      return;
    }

    videoPlayer.pause();
  }, [isFocused, videoPlayer]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      LayoutAnimation.configureNext({
        duration: 0,
        update: { type: LayoutAnimation.Types.keyboard },
        delete: {
          type: LayoutAnimation.Types.keyboard,
          property: LayoutAnimation.Properties.opacity,
        },
      });
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext({
        duration: 100,
        update: { type: LayoutAnimation.Types.keyboard },
        create: {
          type: LayoutAnimation.Types.keyboard,
          property: LayoutAnimation.Properties.opacity,
        },
      });
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <VideoView
        style={styles.video}
        player={videoPlayer}
        contentFit="cover"
        nativeControls={false}
        surfaceType={Platform.OS === "android" ? "textureView" : undefined}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[styles.overlay, { backgroundColor: theme.color.background }]}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
        >
          {/* Header - Static */}
          <View style={styles.logoContainer}>
            <Image
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Center - Keyboard Avoiding Area */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
            style={styles.inputZone}
          >
            <View style={styles.spacer} />
            <View
              style={[
                styles.inputWrapper,
                isKeyboardVisible && styles.inputWrapperKeyboard,
              ]}
            >
              {!isKeyboardVisible && hasSocialAuth && (
                <>
                  <AuthSocialButtons
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    isLoading={isSocialSubmitting}
                    isDisabled={isSocialDisabled}
                    showGoogleButton={showGoogleButton}
                    showAppleButton={showAppleButton}
                    onGooglePress={onGooglePress}
                    onApplePress={onApplePress}
                  />
                  <AuthDivider theme={theme} copy={copy} />
                </>
              )}
              <AuthEmailField
                theme={theme}
                copy={copy}
                value={email}
                isSubmitting={isEmailSubmitting}
                onChangeText={onEmailChange}
                onSubmit={(submittedEmail) => {
                  onEmailChange(submittedEmail);
                  onSubmitEmail(submittedEmail);
                }}
              />
            </View>
          </KeyboardAvoidingView>

          {/* Footer - Static */}
          <View style={styles.legalZone}>
            <Text
              style={[
                styles.legalText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {copy.legal.intro}{" "}
              <Text
                style={[styles.link, { color: theme.color.foreground }]}
                onPress={() =>
                  Linking.openURL(
                    process.env.EXPO_PUBLIC_TERMS_URL ??
                      "https://trefix.run/terms",
                  )
                }
              >
                {copy.legal.terms}
              </Text>{" "}
              {copy.legal.conjunction}{" "}
              <Text
                style={[styles.link, { color: theme.color.foreground }]}
                onPress={() =>
                  Linking.openURL(
                    process.env.EXPO_PUBLIC_PRIVACY_URL ??
                      "https://trefix.run/privacy",
                  )
                }
              >
                {copy.legal.privacy}
              </Text>
              .
            </Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  logoContainer: {
    alignItems: "center",
  },
  logo: {
    width: 220,
    height: 72,
  },
  inputZone: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  inputWrapper: {
    gap: 12,
  },
  inputWrapperKeyboard: {
    paddingBottom: 0,
  },
  legalZone: {
    alignItems: "center",
    marginTop: 12,
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  link: {
    textDecorationLine: "none",
  },
});
