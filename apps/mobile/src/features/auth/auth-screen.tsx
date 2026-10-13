import { useEffect, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  View,
  Keyboard,
  Linking,
  Text,
  TouchableWithoutFeedback,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useVideoPlayer, VideoView } from "expo-video";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusBar } from "expo-status-bar";

import {
  getMobileThemeTokens,
  type ThemeMode,
  type ThemeTokens,
} from "@trefix/tokens";
import {
  AuthSocialButtons,
  BUTTON_FADE_END,
} from "./components/auth-social-buttons";
import { AuthDivider } from "./components/auth-divider";
import { AuthEmailField } from "./components/auth-email-field";
import { type AuthCopy } from "../../locales";

type Props = {
  /** Ignored: the screen is always dark, see `SCREEN_THEME`. */
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

/**
 * The background video is always covered by the dark overlay, in both app themes:
 * a light veil washes the video out. Everything on top uses the dark palette too,
 * so text and buttons stay readable on it.
 */
const SCREEN_MODE: ThemeMode = "dark";
const SCREEN_THEME = getMobileThemeTokens(SCREEN_MODE);

const LEGAL_ZONE_MARGIN_TOP = 12;
/** Gap between the email field and the top edge of the keyboard. */
const KEYBOARD_GAP = 16;
/** Used until the keyboard has been fully opened once and its real height is known. */
const FALLBACK_KEYBOARD_HEIGHT = 300;

export function AuthScreen({
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
  const theme = SCREEN_THEME;
  const themeMode = SCREEN_MODE;
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

    const showSubscription = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Everything below is driven frame-by-frame by the keyboard itself, so the field
  // follows the keyboard exactly instead of jumping after it.
  const keyboard = useAnimatedKeyboard();
  const fullKeyboardHeight = useSharedValue(FALLBACK_KEYBOARD_HEIGHT);
  const legalZoneHeight = useSharedValue(0);
  const contentPaddingBottom = insets.bottom + 24;

  useAnimatedReaction(
    () => ({ state: keyboard.state.value, height: keyboard.height.value }),
    ({ state, height }) => {
      if (state === KeyboardState.OPEN && height > 0) {
        fullKeyboardHeight.value = height;
      }
    },
  );

  const inputGroupStyle = useAnimatedStyle(() => {
    // Distance from the bottom of the field group to the screen edge at rest.
    const restOffset =
      contentPaddingBottom + legalZoneHeight.value + LEGAL_ZONE_MARGIN_TOP;
    const lift = Math.max(
      0,
      keyboard.height.value + KEYBOARD_GAP - restOffset,
    );

    return { transform: [{ translateY: -lift }] };
  });

  const keyboardProgress = useDerivedValue(() =>
    interpolate(
      keyboard.height.value,
      [0, fullKeyboardHeight.value],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  );

  // No opacity here: the social buttons are glass views, and UIKit stops rendering
  // them once an ancestor is translucent. They fade themselves via `hideProgress`.
  const socialBlockStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(keyboardProgress.value, [0, 1], [0, -12]) },
      { scale: interpolate(keyboardProgress.value, [0, 1], [1, 0.97]) },
    ],
  }));

  const dividerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      keyboardProgress.value,
      [0, BUTTON_FADE_END],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const legalZoneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      keyboardProgress.value,
      [0, 0.3],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const handleLegalZoneLayout = (event: LayoutChangeEvent) => {
    legalZoneHeight.value = event.nativeEvent.layout.height;
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      {isFocused ? <StatusBar style="light" /> : null}
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
            { paddingTop: insets.top + 16, paddingBottom: contentPaddingBottom },
          ]}
        >
          <View style={styles.logoContainer}>
            <Image
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.inputZone}>
            <View style={styles.spacer} />
            <Animated.View style={[styles.inputWrapper, inputGroupStyle]}>
              {hasSocialAuth && (
                <Animated.View
                  style={[styles.inputWrapper, socialBlockStyle]}
                  pointerEvents={isKeyboardVisible ? "none" : "auto"}
                  accessibilityElementsHidden={isKeyboardVisible}
                  importantForAccessibility={
                    isKeyboardVisible ? "no-hide-descendants" : "auto"
                  }
                >
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
                    isHidden={isKeyboardVisible}
                    hideProgress={keyboardProgress}
                  />
                  <Animated.View style={dividerStyle}>
                    <AuthDivider theme={theme} copy={copy} />
                  </Animated.View>
                </Animated.View>
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
            </Animated.View>
          </View>

          <Animated.View
            style={[styles.legalZone, legalZoneStyle]}
            onLayout={handleLegalZoneLayout}
          >
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
          </Animated.View>
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
  legalZone: {
    alignItems: "center",
    marginTop: LEGAL_ZONE_MARGIN_TOP,
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
