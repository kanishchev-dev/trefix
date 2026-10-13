import { useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { HeaderContext, type HeaderOptions } from "../context/header-context";
import { Header } from "./header";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  children: ReactNode;
};

/** Frame of a tab or a pushed screen: its own glass header, configured by the screen through `useHeaderOptions`. */
export function PushedScreen({ theme, themeMode, children }: Props) {
  const [options, setOptions] = useState<HeaderOptions>({});
  const context = useMemo(() => ({ options, setOptions }), [options]);

  return (
    <HeaderContext.Provider value={context}>
      <View style={[styles.root, { backgroundColor: theme.color.screen }]}>
        <Header
          theme={theme}
          themeMode={themeMode}
          leftAction={options.leftAction}
          centerContent={options.centerContent}
          rightAction={options.rightAction}
          variant={options.variant}
          bottomContent={options.bottomContent}
        />
        <View style={styles.content}>{children}</View>
      </View>
    </HeaderContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
