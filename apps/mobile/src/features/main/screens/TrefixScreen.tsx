import { StyleSheet, View } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";
import {
  HeaderBackButton,
  HeaderTitlePill,
} from "../components/Header";
import { SectionScreenShell } from "../components/SectionScreenShell";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  onBack: () => void;
};

export function TrefixScreen({ theme, themeMode, onBack }: Props) {
  const backgroundCardColor =
    themeMode === "dark" ? "rgba(74, 29, 111, 0.34)" : "rgba(74, 29, 111, 0.22)";
  const accentBackgroundColor =
    themeMode === "dark" ? "rgba(95, 40, 154, 0.42)" : "rgba(95, 40, 154, 0.3)";

  return (
    <SectionScreenShell
      backgroundContent={
        <View style={styles.backgroundLayer}>
          <View
            style={[
              styles.glowTop,
              { backgroundColor: accentBackgroundColor },
            ]}
          />
          <View
            style={[
              styles.glowMid,
              { backgroundColor: backgroundCardColor },
            ]}
          />
          <View
            style={[
              styles.glowLower,
              { backgroundColor: "rgba(28, 13, 38, 0.55)" },
            ]}
          />
        </View>
      }
      leftAction={<HeaderBackButton theme={theme} onPress={onBack} />}
      headerCenter={<HeaderTitlePill theme={theme} title="Трефикс" subtitle="в сети" />}
      headerContentHeight={72}
      theme={theme}
      themeMode={themeMode}
    >
      {null}
    </SectionScreenShell>
  );
}

const styles = StyleSheet.create({
  backgroundLayer: {
    flex: 1,
    backgroundColor: "#050507",
  },
  glowTop: {
    position: "absolute",
    top: 20,
    left: 92,
    right: 20,
    height: 88,
    borderRadius: 28,
  },
  glowMid: {
    position: "absolute",
    top: 94,
    left: 60,
    right: 28,
    height: 72,
    borderRadius: 22,
  },
  glowLower: {
    position: "absolute",
    top: 198,
    left: 16,
    right: 16,
    height: 26,
    borderRadius: 16,
  },
});
