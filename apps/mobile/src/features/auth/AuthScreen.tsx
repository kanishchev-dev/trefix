import { useEffect } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { AuthSocialButtons } from "./components/AuthSocialButtons";
import { AuthDivider } from "./components/AuthDivider";
import { AuthEmailField } from "./components/AuthEmailField";
import { AuthLegalAgreement } from "./components/AuthLegalAgreement";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

export function AuthScreen({ theme, themeMode }: Props) {
  const insets = useSafeAreaInsets();
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
      <View pointerEvents="none" style={[styles.logoWrap, { paddingTop: insets.top + 16 }]}>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + 24 }]}>
        <AuthSocialButtons theme={theme} themeMode={themeMode} />
        <AuthDivider theme={theme} />
        <AuthEmailField theme={theme} />
        <AuthLegalAgreement theme={theme} />
      </View>
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
    opacity: 0.99,
  },
  logoWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    zIndex: 2,
  },
  logo: {
    width: 220,
    height: 72,
  },
  actionsContainer: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 0,
    gap: 12,
  },
});
