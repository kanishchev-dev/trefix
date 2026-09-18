import { StyleSheet, Text } from "react-native";
import { type ThemeTokens } from "@workspace/tokens";

import {
  HeaderLogo,
  HeaderPlusButton,
  HeaderTemplateButton,
} from "../components/header";
import { SectionLayout } from "../components/section-layout";
import { type MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

const LOREM_IPSUM = `
PLANNING CONTENT:
1. Breakfast with Lorem
2. Meeting with Ipsum
3. Lunch with Dolor
4. Coding with Sit Amet
5. Review with Consectetur

Repeat until success:
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
`.repeat(10);

export function PlanScreen({ theme, themeMode, copy }: Props) {
  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  return (
    <SectionLayout
      leftAction={<HeaderTemplateButton theme={theme} onPress={() => undefined} />}
      headerCenter={<HeaderLogo source={logoSource} />}
      rightAction={<HeaderPlusButton theme={theme} onPress={() => undefined} />}
      scrollable
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
        {copy.tabs.plan}
      </Text>
      <Text
        style={[
          styles.text,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {LOREM_IPSUM}
      </Text>
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 36,
    marginBottom: 24,
  },
  text: {
    fontSize: 18,
    lineHeight: 28,
  },
});
