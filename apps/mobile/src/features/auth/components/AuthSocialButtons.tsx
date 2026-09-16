import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
  Platform,
  type ImageSourcePropType,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { GlassView } from "expo-glass-effect";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { type AuthCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: AuthCopy;
  isLoading?: boolean;
  isDisabled?: boolean;
  showGoogleButton?: boolean;
  showAppleButton?: boolean;
  onGooglePress?: () => void;
  onApplePress?: () => void;
};

export function AuthSocialButtons({
  theme,
  themeMode,
  copy,
  isLoading = false,
  isDisabled = false,
  showGoogleButton = true,
  showAppleButton = false,
  onGooglePress,
  onApplePress,
}: Props) {
  const googleIconSource: ImageSourcePropType =
    themeMode === "dark"
      ? require("../../../../assets/google-icon-dark.png")
      : require("../../../../assets/google-icon-light.png");

  return (
    <View style={styles.root}>
      {showGoogleButton ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.socialButtons.google}
          disabled={isLoading || isDisabled}
          onPress={onGooglePress}
          style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        >
          <GlassView
            isInteractive
            glassEffectStyle="regular"
            tintColor={theme.color.glassTint}
            style={[
              styles.button,
              {
                borderColor: theme.color.glassBorder,
                backgroundColor: theme.color.glassBackground,
              },
            ]}
          >
            <Image
              source={googleIconSource}
              style={styles.googleIcon}
              resizeMode="contain"
            />
            <Text
              style={[
                styles.label,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {isLoading
                ? copy.socialButtons.loading
                : copy.socialButtons.google}
            </Text>
          </GlassView>
        </Pressable>
      ) : null}

      {showAppleButton && Platform.OS === "ios" ? (
        <View style={styles.appleButtonWrap}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              themeMode === "dark"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={20}
            onPress={() => {
              if (isLoading || isDisabled) {
                return;
              }

              onApplePress?.();
            }}
            style={[
              styles.appleButton,
              (isLoading || isDisabled) && styles.appleButtonDisabled,
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  pressable: {
    alignSelf: "stretch",
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  button: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 12,
    overflow: "hidden",
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  appleButtonWrap: {
    alignSelf: "stretch",
    height: 56,
  },
  appleButton: {
    width: "100%",
    height: "100%",
  },
  appleButtonDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
});
