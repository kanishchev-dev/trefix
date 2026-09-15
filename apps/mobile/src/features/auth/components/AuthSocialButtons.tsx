import { Pressable, StyleSheet, Text, View, Image, type ImageSourcePropType } from "react-native";
import { GlassView } from "expo-glass-effect";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onGooglePress?: () => void;
  onApplePress?: () => void;
};

export function AuthSocialButtons({ theme, themeMode, onGooglePress, onApplePress }: Props) {
  const googleIconSource: ImageSourcePropType =
    themeMode === "dark"
      ? require("../../../../assets/google-icon-dark.png")
      : require("../../../../assets/google-icon-light.png");

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Продолжить с Google"
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
          <Image source={googleIconSource} style={styles.googleIcon} resizeMode="contain" />
          <Text
            style={[
              styles.label,
              { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.semibold },
            ]}
          >
            Продолжить с Google
          </Text>
        </GlassView>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Продолжить с Apple"
        onPress={onApplePress}
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
          <Text style={[styles.appleGlyph, { color: theme.color.foreground }]}></Text>
          <Text
            style={[
              styles.label,
              { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.semibold },
            ]}
          >
            Продолжить с Apple
          </Text>
        </GlassView>
      </Pressable>
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
  appleGlyph: {
    fontSize: 20,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
});
