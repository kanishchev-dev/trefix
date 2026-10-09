import { StyleSheet, Text } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";
import {
  HeaderLogo,
  HeaderMenuButton,
  HeaderOptionsButton,
} from "../components/header";
import { SectionLayout } from "../components/section-layout";
import { type MainCopy } from "../../../locales";

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
    <SectionLayout
      leftAction={
        <HeaderMenuButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => undefined}
        />
      }
      headerCenter={<HeaderLogo source={logoSource} />}
      rightAction={
        <HeaderOptionsButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => undefined}
        />
      }
      theme={theme}
      themeMode={themeMode}
    >
      <Text
        style={[
          styles.title,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {title}
      </Text>
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1,
  },
});
