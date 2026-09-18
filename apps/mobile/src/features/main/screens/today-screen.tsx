import { StyleSheet, Text } from "react-native";
import { type ThemeTokens } from "@workspace/tokens";

import {
  HeaderLogo,
  HeaderMenuButton,
  HeaderSearchButton,
} from "../components/header";
import { SectionLayout } from "../components/section-layout";
import { type MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

const LOREM_IPSUM = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin nisl. Integer in mauris eu nibh euismod gravida.

Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat.

Cras mollis scelerisque nunc. Donec odeo. Nam te, metus a faucibus pretium, ante nulla egestas erat, vitae sodales ipsum lectus sit amet enim.
`.repeat(5);

export function TodayScreen({ theme, themeMode, copy }: Props) {
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
        <HeaderSearchButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => undefined}
        />
      }
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
        {copy.tabs.today}
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
