import { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { type AuthCopy } from "../../../locales";

type Provider = "google" | "apple";

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
  /**
   * Collapses the buttons. The glass is dematerialized natively: UIKit visual
   * effect views stop rendering if any ancestor gets opacity < 1, so callers must
   * not fade a parent of these buttons.
   */
  isHidden?: boolean;
  /** 1 → fully shown, 0 → fully hidden. Drives the fade of the button contents. */
  visibility?: SharedValue<number>;
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
  isHidden = false,
  visibility,
}: Props) {
  const [lastPressed, setLastPressed] = useState<Provider | null>(null);

  const googleIconSource: ImageSourcePropType =
    themeMode === "dark"
      ? require("../../../../assets/google-icon-dark.png")
      : require("../../../../assets/google-icon-light.png");

  const handlePress = (provider: Provider, onPress?: () => void) => () => {
    setLastPressed(provider);
    onPress?.();
  };

  const isProviderLoading = (provider: Provider) =>
    isLoading && lastPressed === provider;

  return (
    <View style={styles.root}>
      {showGoogleButton ? (
        <SocialButton
          theme={theme}
          label={copy.socialButtons.google}
          loadingLabel={copy.socialButtons.loading}
          iconSource={googleIconSource}
          isLoading={isProviderLoading("google")}
          isDisabled={isLoading || isDisabled}
          isHidden={isHidden}
          visibility={visibility}
          onPress={handlePress("google", onGooglePress)}
        />
      ) : null}

      {showAppleButton && Platform.OS === "ios" ? (
        <SocialButton
          theme={theme}
          label={copy.socialButtons.apple}
          loadingLabel={copy.socialButtons.loading}
          iconSource={require("../../../../assets/apple-icon.png")}
          iconStyle={{ tintColor: theme.color.foreground }}
          isLoading={isProviderLoading("apple")}
          isDisabled={isLoading || isDisabled}
          isHidden={isHidden}
          visibility={visibility}
          onPress={handlePress("apple", onApplePress)}
        />
      ) : null}
    </View>
  );
}

type SocialButtonProps = {
  theme: ThemeTokens;
  label: string;
  loadingLabel: string;
  iconSource: ImageSourcePropType;
  iconStyle?: StyleProp<ImageStyle>;
  isLoading: boolean;
  isDisabled: boolean;
  isHidden: boolean;
  visibility?: SharedValue<number>;
  onPress: () => void;
};

const GLASS_ANIMATION_DURATION = 0.15;

function SocialButton({
  theme,
  label,
  loadingLabel,
  iconSource,
  iconStyle,
  isLoading,
  isDisabled,
  isHidden,
  visibility,
  onPress,
}: SocialButtonProps) {
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: visibility ? visibility.value : isHidden ? 0 : 1,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <GlassView
        isInteractive
        glassEffectStyle={{
          style: isHidden ? "none" : "regular",
          animate: true,
          animationDuration: GLASS_ANIMATION_DURATION,
        }}
        tintColor={theme.color.glassTint}
        style={styles.button}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.chrome,
            {
              borderColor: theme.color.glassBorder,
              backgroundColor: theme.color.glassBackground,
            },
            fadeStyle,
          ]}
        />
        <Animated.View style={[styles.content, fadeStyle]}>
          <Image
            source={iconSource}
            style={[styles.icon, iconStyle]}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.label,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {isLoading ? loadingLabel : label}
          </Text>
        </Animated.View>
      </GlassView>
    </Pressable>
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
    borderRadius: 9999,
    justifyContent: "center",
    overflow: "hidden",
  },
  chrome: {
    ...StyleSheet.absoluteFill,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 12,
  },
  icon: {
    width: 18,
    height: 18,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
});
