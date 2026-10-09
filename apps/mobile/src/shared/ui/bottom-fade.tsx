import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

type Props = {
  /** Total height from the bottom edge of the screen. */
  height: number;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/** Content fades into blur at the bottom edge, mirroring the header at the top. */
export function BottomFade({ height, theme, themeMode }: Props) {
  return (
    <View pointerEvents="none" style={[styles.root, { height }]}>
      <MaskedView
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.15)", "rgba(0, 0, 0, 0.5)", "rgba(0, 0, 0, 0.85)", "rgba(0, 0, 0, 1)"]}
            locations={[0, 0.15, 0.35, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <BlurView intensity={16} tint="regular" pointerEvents="none" style={StyleSheet.absoluteFill} />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.color.background, opacity: themeMode === "dark" ? 0.72 : 0.62 },
          ]}
        />
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
