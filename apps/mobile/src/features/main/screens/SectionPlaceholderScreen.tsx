import { StyleSheet, Text } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";
import {
  HeaderLogo,
  HeaderMenuButton,
  HeaderOptionsButton,
} from "../components/Header";
import { SectionScreenShell } from "../components/SectionScreenShell";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  title: string;
};

export function SectionPlaceholderScreen({ theme, themeMode, title }: Props) {
  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  return (
    <SectionScreenShell
      leftAction={<HeaderMenuButton theme={theme} onPress={() => undefined} />}
      headerCenter={<HeaderLogo source={logoSource} />}
      rightAction={<HeaderOptionsButton theme={theme} onPress={() => undefined} />}
      theme={theme}
      themeMode={themeMode}
    >
      <Text
        style={[
          styles.title,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.extrabold,
          },
        ]}
      >
        {title}
      </Text>
    </SectionScreenShell>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1,
  },
});
