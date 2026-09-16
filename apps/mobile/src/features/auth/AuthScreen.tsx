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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { AuthSocialButtons } from "./components/AuthSocialButtons";
import { AuthDivider } from "./components/AuthDivider";
import { AuthEmailField } from "./components/AuthEmailField";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

export function AuthScreen({ theme, themeMode }: Props) {
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const videoPlayer = useVideoPlayer(require("../../../assets/auth-background.mov"), (player) => {
    player.loop = true;
    player.muted = true;
  });

  const logoSource =
    themeMode === "dark"
      ? require("../../../assets/trefix-logo-light.png")
      : require("../../../assets/trefix-logo-dark.png");

  useEffect(() => {
    void videoPlayer.play();

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
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
    const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
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
  }, [videoPlayer]);

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
        <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
          {/* Header - Static */}
          <View style={styles.logoContainer}>
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Center - Keyboard Avoiding Area */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
            style={styles.inputZone}
          >
            <View style={styles.spacer} />
            <View style={[styles.inputWrapper, isKeyboardVisible && styles.inputWrapperKeyboard]}>
              {!isKeyboardVisible && (
                <>
                  <AuthSocialButtons theme={theme} themeMode={themeMode} />
                  <AuthDivider theme={theme} />
                </>
              )}
              <AuthEmailField theme={theme} />
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
              Нажимая «Продолжить», вы соглашаетесь с{" "}
              <Text
                style={[styles.link, { color: theme.color.foreground }]}
                onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL ?? "https://trefix.io/terms")}
              >
                Условиями использования
              </Text>{" "}
              и{" "}
              <Text
                style={[styles.link, { color: theme.color.foreground }]}
                onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://trefix.io/privacy")}
              >
                Политикой конфиденциальности
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
    paddingHorizontal: 24,
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
});
